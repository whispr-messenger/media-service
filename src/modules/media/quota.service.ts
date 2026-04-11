import { BadRequestException, Injectable, Inject, Logger, PayloadTooLargeException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { createClient } from '@redis/client';
import { UserQuota } from './entities/user-quota.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { REDIS_CLIENT } from './media.tokens';
import {
	DEFAULT_STORAGE_LIMIT_BYTES,
	DEFAULT_FILES_LIMIT,
	DEFAULT_DAILY_UPLOAD_LIMIT,
} from './quota.constants';

// @keyv/redis (used by cache-manager v7) passes TTL to Redis as PX (milliseconds).
// The global CacheModule default (ttl: 900) is also milliseconds = 0.9 s.
const QUOTA_CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour in milliseconds

// Cooldown TTL for quota alert events (in seconds)
const QUOTA_ALERT_COOLDOWN_TTL_SECONDS = 60 * 60; // 1 hour

// Storage usage thresholds that trigger a quota.alert event
const QUOTA_ALERT_THRESHOLDS = [80, 95] as const;

// Plain-object DTO stored in Redis. bigint and Date do not survive JSON round-trips,
// so we serialise them to string/string and rehydrate on read.
interface CachedQuota {
	id: string;
	userId: string;
	storageUsed: string;
	storageLimit: string;
	filesCount: number;
	filesLimit: number;
	dailyUploads: number;
	dailyUploadLimit: number;
	quotaDate: string;
}

interface QuotaCheckResult {
	allowed: boolean;
	reason?: string;
	storageUsed: bigint;
	storageLimit: bigint;
	filesCount: number;
	filesLimit: number;
	dailyUploads: number;
	dailyUploadLimit: number;
}

/**
 * QuotaService manages per-user upload quotas with a Redis cache layer.
 *
 * ## Pre-upload check (WHISPR-356)
 * Before accepting any upload, checks:
 *  - storage_used + blob_size <= storage_limit
 *  - files_count < files_limit
 *  - daily_uploads < daily_upload_limit
 *
 * Uses Redis cache (quota:user:{userId}, TTL 1h) as first layer, falls back
 * to PostgreSQL on miss. Creates a new user_quotas row on first access.
 *
 * ## Atomic update after upload/delete (WHISPR-357)
 * After successful upload: atomically increments storage_used, files_count,
 * daily_uploads inside a transaction, then invalidates cache.
 * After soft delete: decrements storage_used and files_count.
 *
 * ## Daily reset cron (WHISPR-358)
 * @Cron('0 0 * * *') at midnight UTC resets daily_uploads for all rows
 * where quota_date < CURRENT_DATE and invalidates affected caches.
 */
@Injectable()
export class QuotaService {
	private readonly logger = new Logger(QuotaService.name);

	constructor(
		@Inject(CACHE_MANAGER)
		private readonly cache: Cache,
		private readonly dataSource: DataSource,
		@Inject(REDIS_CLIENT)
		private readonly redisClient: ReturnType<typeof createClient>
	) {}

	// -------------------------------------------------------------------------
	// WHISPR-356: Pre-upload quota check
	// -------------------------------------------------------------------------

	async checkQuota(userId: string, blobSize: number): Promise<QuotaCheckResult> {
		this.validateBlobSize(blobSize);
		const quota = await this.getOrCreateQuota(userId);

		const result: QuotaCheckResult = {
			allowed: true,
			storageUsed: quota.storageUsed,
			storageLimit: quota.storageLimit,
			filesCount: quota.filesCount,
			filesLimit: quota.filesLimit,
			dailyUploads: quota.dailyUploads,
			dailyUploadLimit: quota.dailyUploadLimit,
		};

		if (quota.storageUsed + BigInt(blobSize) > quota.storageLimit) {
			result.allowed = false;
			result.reason = 'Storage limit exceeded';
		} else if (quota.filesCount >= quota.filesLimit) {
			result.allowed = false;
			result.reason = 'Files count limit exceeded';
		} else if (quota.dailyUploads >= quota.dailyUploadLimit) {
			result.allowed = false;
			result.reason = 'Daily upload limit exceeded';
		}

		return result;
	}

	/**
	 * Throws PayloadTooLargeException (413) if the quota is exceeded.
	 */
	async enforceQuota(userId: string, blobSize: number): Promise<void> {
		const result = await this.checkQuota(userId, blobSize);
		if (!result.allowed) {
			throw new PayloadTooLargeException({
				message: result.reason,
				storageUsed: result.storageUsed.toString(),
				storageLimit: result.storageLimit.toString(),
				filesCount: result.filesCount,
				filesLimit: result.filesLimit,
				dailyUploads: result.dailyUploads,
				dailyUploadLimit: result.dailyUploadLimit,
			});
		}
	}

	// -------------------------------------------------------------------------
	// WHISPR-357: Atomic quota update after upload and delete
	// -------------------------------------------------------------------------

	/**
	 * Atomically increments storage_used, files_count and daily_uploads
	 * after a successful upload. Invalidates Redis cache for the user.
	 * Also publishes a quota.alert event if usage crosses 80% or 95% thresholds.
	 */
	async recordUpload(userId: string, blobSize: number): Promise<void> {
		this.validateBlobSize(blobSize);
		await this.dataSource.transaction(async (manager) => {
			const result = await manager
				.createQueryBuilder()
				.update(UserQuota)
				.set({
					storageUsed: () => '"storage_used" + :blobSize',
					filesCount: () => '"files_count" + 1',
					dailyUploads: () => '"daily_uploads" + 1',
				})
				.where('user_id = :userId', { userId })
				.setParameters({ blobSize })
				.execute();
			if (!result.affected) {
				throw new Error(`No quota row found for user ${userId}`);
			}
		});
		// Cache invalidation happens after the transaction commits. In the unlikely
		// event of a crash between commit and DEL, the cache will serve stale data
		// until the TTL expires (1 hour). This is an accepted trade-off.
		await this.invalidateCache(userId);

		// WHISPR-371: Check thresholds and publish quota.alert if needed (fire-and-forget)
		this.checkAndPublishQuotaAlert(userId).catch((err: unknown) => {
			this.logger.error(
				`Failed to publish quota.alert for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
			);
		});
	}

	/**
	 * Atomically decrements storage_used and files_count after a soft delete.
	 * Ensures values never go below zero. Invalidates Redis cache.
	 */
	async recordDelete(userId: string, blobSize: number): Promise<void> {
		this.validateBlobSize(blobSize);
		await this.dataSource.transaction(async (manager) => {
			const result = await manager
				.createQueryBuilder()
				.update(UserQuota)
				.set({
					storageUsed: () => 'GREATEST(0, "storage_used" - :blobSize)',
					filesCount: () => 'GREATEST(0, "files_count" - 1)',
				})
				.where('user_id = :userId', { userId })
				.setParameters({ blobSize })
				.execute();
			if (!result.affected) {
				throw new Error(`No quota row found for user ${userId}`);
			}
		});
		// Same post-transaction invalidation trade-off as recordUpload.
		await this.invalidateCache(userId);
	}

	// -------------------------------------------------------------------------
	// WHISPR-358: Daily daily_uploads reset cron
	// -------------------------------------------------------------------------

	/**
	 * Runs at midnight UTC every day.
	 * Delegates to the `media.reset_daily_uploads()` SECURITY DEFINER function
	 * (created by migration 1742800000000) which bypasses RLS to update all
	 * stale rows atomically. Returns the affected user IDs so their caches
	 * can be invalidated.
	 */
	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
	async resetDailyUploads(): Promise<void> {
		this.logger.log('Running daily quota reset');

		const rows: Array<{ user_id: string }> = await this.dataSource.query(
			`SELECT user_id FROM media.reset_daily_uploads()`
		);

		this.logger.log(`Daily quota reset: ${rows.length} user(s) updated`);

		// Invalidate Redis cache for all affected users in chunks to avoid Redis burst
		const userIds = rows.map((r) => r.user_id);
		const CHUNK_SIZE = 100;
		for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
			await Promise.all(userIds.slice(i, i + CHUNK_SIZE).map((id) => this.invalidateCache(id)));
		}
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	private cacheKey(userId: string): string {
		return `quota:user:${userId}`;
	}

	private async invalidateCache(userId: string): Promise<void> {
		try {
			await this.cache.del(this.cacheKey(userId));
		} catch (err) {
			this.logger.error(
				`Failed to invalidate quota cache for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}

	private async getOrCreateQuota(userId: string): Promise<UserQuota> {
		const key = this.cacheKey(userId);
		let cached: CachedQuota | null = null;
		try {
			cached = await this.cache.get<CachedQuota>(key);
		} catch (err) {
			this.logger.warn(
				`Failed to read quota cache for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
			);
		}
		if (cached) {
			// Rehydrate bigint fields from their serialised string form.
			return {
				...cached,
				storageUsed: BigInt(cached.storageUsed),
				storageLimit: BigInt(cached.storageLimit),
			} as UserQuota;
		}

		// Wrap in an explicit transaction so RlsSubscriber sets app.current_user_id
		// via set_config(..., true) before the findOne/insert queries run.
		// Without a transaction the GUC is never set and RLS blocks the queries.
		const quota = await this.dataSource.transaction(async (manager) => {
			const repo = manager.getRepository(UserQuota);
			let row = await repo.findOne({ where: { userId } });

			if (!row) {
				// Upsert — concurrent inserts are handled by the unique index.
				// Use CURRENT_DATE (DB clock) to stay consistent with the cron reset.
				await manager
					.createQueryBuilder()
					.insert()
					.into(UserQuota)
					.values({
						userId,
						storageUsed: BigInt(0),
						storageLimit: BigInt(DEFAULT_STORAGE_LIMIT_BYTES),
						filesCount: 0,
						filesLimit: DEFAULT_FILES_LIMIT,
						dailyUploads: 0,
						dailyUploadLimit: DEFAULT_DAILY_UPLOAD_LIMIT,
						quotaDate: () => 'CURRENT_DATE',
					})
					.orIgnore()
					.execute();
				row = await repo.findOne({ where: { userId } });
			}

			if (!row) {
				throw new Error(`Failed to create or fetch quota for user ${userId}`);
			}

			return row;
		});

		// Serialise to a plain DTO before caching: bigint does not survive JSON
		// round-trips through Redis (JSON.stringify throws on bigint values).
		const dto: CachedQuota = {
			id: quota.id,
			userId: quota.userId,
			storageUsed: quota.storageUsed.toString(),
			storageLimit: quota.storageLimit.toString(),
			filesCount: quota.filesCount,
			filesLimit: quota.filesLimit,
			dailyUploads: quota.dailyUploads,
			dailyUploadLimit: quota.dailyUploadLimit,
			quotaDate: quota.quotaDate,
		};
		try {
			await this.cache.set(key, dto, QUOTA_CACHE_TTL_MS);
		} catch (err) {
			this.logger.warn(
				`Failed to write quota cache for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
			);
		}
		return quota;
	}

	// -------------------------------------------------------------------------
	// WHISPR-371: quota.alert Redis pub/sub events
	// -------------------------------------------------------------------------

	/**
	 * Reads the current quota for the user and publishes a `quota.alert` event
	 * if storage usage crosses 80% or 95% thresholds, subject to a 1h cooldown.
	 */
	private async checkAndPublishQuotaAlert(userId: string): Promise<void> {
		const quota = await this.getOrCreateQuota(userId);
		if (quota.storageLimit === 0n) {
			return;
		}

		const percentUsed = Number((quota.storageUsed * 100n) / quota.storageLimit);

		for (const threshold of QUOTA_ALERT_THRESHOLDS) {
			if (percentUsed >= threshold) {
				await this.publishQuotaAlert(userId, quota.storageUsed, quota.storageLimit, threshold);
			}
		}
	}

	/**
	 * Publishes a `quota.alert` event to Redis pub/sub if no cooldown key is set.
	 * Cooldown key: `quota:alert:cooldown:{userId}:{percent}`, TTL 1h.
	 */
	private async publishQuotaAlert(
		userId: string,
		storageUsed: bigint,
		storageLimit: bigint,
		percent: number
	): Promise<void> {
		const cooldownKey = `quota:alert:cooldown:${userId}:${percent}`;

		// SET NX with EX to atomically check and set cooldown
		const acquired = await this.redisClient.set(cooldownKey, '1', {
			NX: true,
			EX: QUOTA_ALERT_COOLDOWN_TTL_SECONDS,
		});
		if (!acquired) {
			// Cooldown active — skip publishing
			return;
		}

		const payload = JSON.stringify({
			userId,
			storageUsed: storageUsed.toString(),
			storageLimit: storageLimit.toString(),
			percent,
		});

		await this.redisClient.publish('quota.alert', payload);
		this.logger.log(`Published quota.alert for user ${userId} at ${percent}% usage`);
	}

	/**
	 * Guards against invalid blobSize values before they reach BigInt conversion
	 * or SQL parameters. BigInt() throws a SyntaxError for NaN/Infinity/floats;
	 * negative values would corrupt quota arithmetic.
	 */
	private validateBlobSize(blobSize: number): void {
		if (!Number.isSafeInteger(blobSize) || blobSize < 0) {
			throw new BadRequestException(`Invalid blobSize: ${blobSize}`);
		}
	}
}

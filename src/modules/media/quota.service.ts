import { Injectable, Inject, Logger, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource, Repository } from 'typeorm';
import { UserQuota } from './entities/user-quota.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

const QUOTA_CACHE_TTL_S = 60 * 60; // 1 hour (cache-manager TTL is in seconds)

interface QuotaCheckResult {
	allowed: boolean;
	reason?: string;
	storageUsed: number;
	storageLimit: number;
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
		@InjectRepository(UserQuota)
		private readonly quotaRepo: Repository<UserQuota>,
		@Inject(CACHE_MANAGER)
		private readonly cache: Cache,
		private readonly dataSource: DataSource
	) {}

	// -------------------------------------------------------------------------
	// WHISPR-356: Pre-upload quota check
	// -------------------------------------------------------------------------

	async checkQuota(userId: string, blobSize: number): Promise<QuotaCheckResult> {
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

		if (BigInt(quota.storageUsed) + BigInt(blobSize) > BigInt(quota.storageLimit)) {
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
				storageUsed: result.storageUsed,
				storageLimit: result.storageLimit,
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
	 */
	async recordUpload(userId: string, blobSize: number): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await manager
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
		});
		await this.invalidateCache(userId);
	}

	/**
	 * Atomically decrements storage_used and files_count after a soft delete.
	 * Ensures values never go below zero. Invalidates Redis cache.
	 */
	async recordDelete(userId: string, blobSize: number): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			await manager
				.createQueryBuilder()
				.update(UserQuota)
				.set({
					storageUsed: () => 'GREATEST(0, "storage_used" - :blobSize)',
					filesCount: () => 'GREATEST(0, "files_count" - 1)',
				})
				.where('user_id = :userId', { userId })
				.setParameters({ blobSize })
				.execute();
		});
		await this.invalidateCache(userId);
	}

	// -------------------------------------------------------------------------
	// WHISPR-358: Daily daily_uploads reset cron
	// -------------------------------------------------------------------------

	/**
	 * Runs at midnight UTC every day.
	 * Resets daily_uploads = 0 and updates quota_date = CURRENT_DATE
	 * for all rows where quota_date < CURRENT_DATE.
	 * Invalidates Redis cache for all affected users.
	 */
	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
	async resetDailyUploads(): Promise<void> {
		this.logger.log('Running daily quota reset');

		const affected = await this.quotaRepo
			.createQueryBuilder()
			.update(UserQuota)
			.set({ dailyUploads: 0, quotaDate: () => 'CURRENT_DATE' })
			.where('"quota_date" < CURRENT_DATE')
			.returning('"user_id"')
			.execute();

		const count = affected.affected ?? 0;
		this.logger.log(`Daily quota reset: ${count} user(s) updated`);

		// Invalidate Redis cache for all affected users in chunks to avoid Redis burst
		const userIds: string[] = ((affected.raw ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
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
		await this.cache.del(this.cacheKey(userId));
	}

	private async getOrCreateQuota(userId: string): Promise<UserQuota> {
		const key = this.cacheKey(userId);
		const cached = await this.cache.get<UserQuota>(key);
		if (cached) {
			return cached;
		}

		let quota = await this.quotaRepo.findOne({ where: { userId } });

		if (!quota) {
			// Upsert — concurrent inserts are handled by the unique index
			const today = new Date().toISOString().slice(0, 10);
			await this.quotaRepo
				.createQueryBuilder()
				.insert()
				.into(UserQuota)
				.values({ userId, quotaDate: today })
				.orIgnore()
				.execute();
			quota = await this.quotaRepo.findOne({ where: { userId } });
		}

		if (!quota) {
			throw new Error(`Failed to create or fetch quota for user ${userId}`);
		}

		await this.cache.set(key, quota, QUOTA_CACHE_TTL_S);
		return quota;
	}
}

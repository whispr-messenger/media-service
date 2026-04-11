import {
	ForbiddenException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	NotImplementedException,
	PayloadTooLargeException,
	UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import { createHash } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { UserQuota } from './entities/user-quota.entity';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { MediaRepository } from './repositories/media.repository';
import { StorageService, StorageContext } from './storage.service';
import { QuotaService } from './quota.service';
import { validateMagicBytes } from './magic-bytes.validator';
import { createClient } from '@redis/client';
import { MediaContext, UploadMediaResponseDto, MediaMetadataDto } from './dto/upload-media.dto';
import { REDIS_CLIENT } from './media.tokens';
import { UserQuotaResponseDto } from './dto/user-quota-response.dto';
import { PaginatedMediaResponseDto } from './dto/paginated-media-response.dto';
import { MetricsService } from '../metrics/metrics.service';
import {
	DEFAULT_STORAGE_LIMIT_BYTES,
	DEFAULT_FILES_LIMIT,
	DEFAULT_DAILY_UPLOAD_LIMIT,
} from './quota.constants';

// Blob size limits per context (in bytes)
const CONTEXT_SIZE_LIMITS: Record<MediaContext, number> = {
	[MediaContext.MESSAGE]: 100 * 1024 * 1024, // 100 MB
	[MediaContext.AVATAR]: 5 * 1024 * 1024, // 5 MB
	[MediaContext.GROUP_ICON]: 5 * 1024 * 1024, // 5 MB
};

const PUBLIC_CONTEXTS = new Set<string>([MediaContext.AVATAR, MediaContext.GROUP_ICON]);

// Strict MIME allowlists per context — unknown types are rejected for uploads
const CONTEXT_MIME_ALLOWLIST: Record<MediaContext, Set<string>> = {
	[MediaContext.MESSAGE]: new Set([
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/heic',
		'image/heif',
		'video/mp4',
		'video/quicktime',
		'video/webm',
		'video/x-matroska',
		'audio/mpeg',
		'audio/ogg',
		'audio/wav',
		'audio/mp4',
		'audio/aac',
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'application/zip',
	]),
	[MediaContext.AVATAR]: new Set([
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/heic',
		'image/heif',
	]),
	[MediaContext.GROUP_ICON]: new Set([
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/heic',
		'image/heif',
	]),
};

// Redis key TTLs
const META_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const DEDUP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SEMAPHORE_TTL_SECONDS = 30 * 60; // 30 min safety net TTL in seconds
const SEMAPHORE_TTL_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // refresh every 5 min while uploading

const MAX_CONCURRENT_UPLOADS = 3;

@Injectable()
export class MediaService {
	private readonly logger = new Logger(MediaService.name);
	private readonly signedUrlExpirySeconds: number;

	constructor(
		private readonly mediaRepository: MediaRepository,
		private readonly storageService: StorageService,
		private readonly quotaService: QuotaService,
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService,
		private readonly dataSource: DataSource,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
		@InjectRepository(UserQuota) private readonly userQuotaRepo: Repository<UserQuota>,
		@InjectRepository(Media) private readonly mediaRepo: Repository<Media>,
		@InjectRepository(MediaAccessLog)
		private readonly accessLogRepo: Repository<MediaAccessLog>,
		@Inject(REDIS_CLIENT) private readonly redisClient: ReturnType<typeof createClient>,
		private readonly metricsService: MetricsService
	) {
		this.signedUrlExpirySeconds = this.configService.get<number>(
			'SIGNED_URL_EXPIRY_SECONDS',
			7 * 24 * 60 * 60
		);
	}

	// =========================================================================
	// POST /media/v1/upload — WHISPR-359
	// =========================================================================

	async upload(
		ownerId: string,
		file: Express.Multer.File,
		context: MediaContext,
		thumbnailFile?: Express.Multer.File
	): Promise<UploadMediaResponseDto> {
		// WHISPR-363: Concurrent upload semaphore (max 3 per user)
		await this.acquireSemaphore(ownerId);

		try {
			return await this.runWithSemaphoreTtlRefresh(ownerId, async () => {
				// WHISPR-356: Pre-upload quota check
				await this.quotaService.enforceQuota(ownerId, file.size);

				// WHISPR-361: Blob size limits per context
				this.enforceContextSizeLimit(file.size, context);

				// WHISPR-360: MIME allowlist + magic bytes validation
				if (!CONTEXT_MIME_ALLOWLIST[context].has(file.mimetype)) {
					throw new UnsupportedMediaTypeException(
						`MIME type '${file.mimetype}' is not allowed for context '${context}'`
					);
				}
				const blobBuffer = file.buffer ?? Buffer.alloc(0);
				validateMagicBytes(blobBuffer, file.mimetype);

				// WHISPR-362: Blob deduplication via SHA-256 (scoped per owner+context)
				const sha256 = createHash('sha256').update(blobBuffer).digest('hex');
				const dedupKey = `dedup:blob:${ownerId}:${context}:${sha256}`;
				const existingId = await this.cache.get<string>(dedupKey);
				if (existingId) {
					const existing = await this.dataSource.transaction((manager) =>
						this.mediaRepository.findById(existingId, manager)
					);
					if (existing) {
						this.logger.debug(`Dedup hit for sha256=${sha256} → reusing media ${existingId}`);
						return this.buildUploadResponse(existing, context);
					}
				}

				const id = randomUUID();
				const storageContext = this.contextToStorageContext(context);
				const storagePath = this.storageService.buildPath(storageContext, ownerId, id);

				this.logger.debug(`Uploading file to ${storagePath}`);
				const blobStream = file.stream ?? Readable.from(blobBuffer);
				await this.storageService.upload(storagePath, blobStream, file.mimetype, file.size);

				let thumbnailPath: string | null = null;
				if (thumbnailFile) {
					// Validate thumbnail: only safe image MIME types, max 5 MB, magic-bytes check
					const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
					const THUMBNAIL_ALLOWED_MIME = new Set([
						'image/jpeg',
						'image/png',
						'image/gif',
						'image/webp',
						'image/heic',
						'image/heif',
					]);
					if (!THUMBNAIL_ALLOWED_MIME.has(thumbnailFile.mimetype)) {
						throw new UnsupportedMediaTypeException(
							`Thumbnail MIME type '${thumbnailFile.mimetype}' is not allowed`
						);
					}
					if (thumbnailFile.size > THUMBNAIL_MAX_BYTES) {
						throw new PayloadTooLargeException(
							`Thumbnail size ${thumbnailFile.size} exceeds the 5 MB limit`
						);
					}
					const thumbBuffer = thumbnailFile.buffer ?? Buffer.alloc(0);
					validateMagicBytes(thumbBuffer, thumbnailFile.mimetype);

					const thumbnailStoragePath = this.storageService.buildPath('thumbnails', ownerId, id);
					const thumbStream = thumbnailFile.stream ?? Readable.from(thumbBuffer);
					await this.storageService.upload(
						thumbnailStoragePath,
						thumbStream,
						thumbnailFile.mimetype,
						thumbnailFile.size
					);
					thumbnailPath = thumbnailStoragePath;
				}

				const media = new Media();
				media.id = id;
				media.ownerId = ownerId;
				media.context = context;
				media.storagePath = storagePath;
				media.thumbnailPath = thumbnailPath;
				media.contentType = file.mimetype;
				media.blobSize = file.size;
				media.expiresAt = context === MediaContext.MESSAGE ? this.computeExpiresAt() : null;
				media.isActive = true;

				await this.dataSource.transaction((manager) => this.mediaRepository.save(media, manager));

				// Cache dedup entry
				await this.cache.set(dedupKey, id, DEDUP_CACHE_TTL_MS);

				// WHISPR-357: Update quota
				await this.quotaService.recordUpload(ownerId, file.size);

				this.metricsService.uploadsTotal.inc();

				return this.buildUploadResponse(media, context);
			});
		} finally {
			await this.releaseSemaphore(ownerId);
		}
	}

	// =========================================================================
	// GET /media/v1/:id — WHISPR-364
	// =========================================================================

	async getMetadata(id: string, requesterId: string): Promise<MediaMetadataDto> {
		const cacheKey = `media:meta:${id}`;
		const cached = await this.cache.get<MediaMetadataDto>(cacheKey);
		if (cached) {
			this.enforceReadAccess(cached.context, cached.ownerId, requesterId);
			return cached;
		}

		const media = await this.dataSource.transaction((manager) =>
			this.mediaRepository.findById(id, manager)
		);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		this.enforceReadAccess(media.context as MediaContext, media.ownerId, requesterId);

		const dto: MediaMetadataDto = {
			id: media.id,
			ownerId: media.ownerId,
			context: media.context as MediaContext,
			contentType: media.contentType,
			blobSize: media.blobSize,
			expiresAt: media.expiresAt,
			isActive: media.isActive,
			createdAt: media.createdAt,
			hasThumbnail: media.thumbnailPath !== null,
		};

		await this.cache.set(cacheKey, dto, META_CACHE_TTL_MS);
		return dto;
	}

	// =========================================================================
	// GET /media/v1/:id/blob — WHISPR-365
	// =========================================================================

	async getBlobUrl(
		id: string,
		requesterId: string,
		ipAddress?: string,
		userAgent?: string
	): Promise<string> {
		const { media, url } = await this.dataSource.transaction(async (manager) => {
			const media = await this.mediaRepository.findById(id, manager);
			if (!media) {
				throw new NotFoundException(`Media ${id} not found`);
			}

			this.enforceReadAccess(media.context as MediaContext, media.ownerId, requesterId);

			return {
				media,
				url: await this.getOrGenerateSignedUrl(media, manager),
			};
		});

		// Async access log (non-blocking)
		this.writeAccessLog(media.id, requesterId, 'blob', ipAddress, userAgent).catch(() => {});

		return url;
	}

	// =========================================================================
	// GET /media/v1/:id/thumbnail — WHISPR-366
	// =========================================================================

	async getThumbnailUrl(
		id: string,
		requesterId: string,
		ipAddress?: string,
		userAgent?: string
	): Promise<string> {
		const media = await this.dataSource.transaction((manager) =>
			this.mediaRepository.findById(id, manager)
		);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}
		if (!media.thumbnailPath) {
			throw new NotFoundException(`Media ${id} has no thumbnail`);
		}

		this.enforceReadAccess(media.context as MediaContext, media.ownerId, requesterId);

		let url: string;
		if (PUBLIC_CONTEXTS.has(media.context)) {
			url = this.storageService.getPublicUrl(media.thumbnailPath);
		} else {
			const command = new GetObjectCommand({
				Bucket: this.storageService.bucket,
				Key: media.thumbnailPath,
			});
			url = await getSignedUrl(this.s3 as never, command, {
				expiresIn: this.signedUrlExpirySeconds,
			});
		}

		this.writeAccessLog(media.id, requesterId, 'thumbnail', ipAddress, userAgent).catch(() => {});

		return url;
	}

	// =========================================================================
	// DELETE /media/v1/:id — WHISPR-367
	// =========================================================================

	async delete(id: string, requesterId: string, ipAddress?: string, userAgent?: string): Promise<void> {
		const media = await this.dataSource.transaction(async (manager) => {
			const media = await this.mediaRepository.findById(id, manager);
			if (!media) {
				throw new NotFoundException(`Media ${id} not found`);
			}

			if (media.ownerId !== requesterId) {
				throw new ForbiddenException(`You do not own media ${id}`);
			}

			// Soft delete DB record first while the RLS GUC is set.
			await this.mediaRepository.softDelete(id, manager);

			return media;
		});

		// Delete underlying S3 objects so storage and quota stay in sync
		await this.storageService.delete(media.storagePath);
		if (media.thumbnailPath) {
			await this.storageService.delete(media.thumbnailPath);
		}

		// Invalidate metadata cache
		await this.cache.del(`media:meta:${id}`);

		// Release quota
		await this.quotaService.recordDelete(requesterId, media.blobSize);

		// Access log
		this.writeAccessLog(media.id, requesterId, 'delete', ipAddress, userAgent).catch(() => {});

		// WHISPR-372: Publish media.deleted event (fire-and-forget — failure does not affect the delete response)
		const deletedPayload = JSON.stringify({
			mediaId: media.id,
			ownerId: media.ownerId,
			context: media.context,
		});
		this.redisClient.publish('media.deleted', deletedPayload).catch((err: unknown) => {
			this.logger.error(
				`Failed to publish media.deleted for media ${id}: ${err instanceof Error ? err.message : String(err)}`
			);
		});

		this.logger.debug(`Soft-deleted media ${id} and removed S3 objects`);
	}

	// =========================================================================
	// Legacy stream helper (kept for backward compatibility)
	// =========================================================================

	async getStream(id: string): Promise<{ stream: Readable; contentType: string }> {
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}
		const stream = await this.storageService.download(media.storagePath);
		return { stream, contentType: media.contentType };
	}

	// =========================================================================
	// GET /media/v1/quota — WHISPR-368
	// =========================================================================

	async getUserQuota(userId: string): Promise<UserQuotaResponseDto> {
		const quota = await this.dataSource.transaction((manager) =>
			manager.getRepository(UserQuota).findOne({ where: { userId } })
		);

		const rawStorageUsed = quota?.storageUsed ?? 0n;
		const rawStorageLimit = quota?.storageLimit ?? BigInt(DEFAULT_STORAGE_LIMIT_BYTES);
		const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
		const storageUsed = rawStorageUsed > maxSafe ? Number.MAX_SAFE_INTEGER : Number(rawStorageUsed);
		const storageLimit = rawStorageLimit > maxSafe ? Number.MAX_SAFE_INTEGER : Number(rawStorageLimit);

		const filesCount = quota?.filesCount ?? 0;
		const filesLimit = quota?.filesLimit ?? DEFAULT_FILES_LIMIT;
		const dailyUploads = quota?.dailyUploads ?? 0;
		const dailyUploadLimit = quota?.dailyUploadLimit ?? DEFAULT_DAILY_UPLOAD_LIMIT;
		const quotaDate = quota?.quotaDate ?? null;

		let usagePercent = 0;
		if (rawStorageLimit > 0n) {
			const percentTimes100 = (rawStorageUsed * 10000n) / rawStorageLimit;
			usagePercent = Math.min(100, Math.max(0, Number(percentTimes100) / 100));
		}

		return {
			storageUsed,
			storageLimit,
			filesCount,
			filesLimit,
			dailyUploads,
			dailyUploadLimit,
			quotaDate,
			usagePercent,
		};
	}

	// =========================================================================
	// GET /media/v1/my-media — WHISPR-369
	// =========================================================================

	async getUserMedia(userId: string, page: number, limit: number): Promise<PaginatedMediaResponseDto> {
		const [items, total] = await this.dataSource.transaction((manager) =>
			manager.getRepository(Media).findAndCount({
				where: { ownerId: userId, isActive: true },
				order: { createdAt: 'DESC' },
				skip: (page - 1) * limit,
				take: limit,
			})
		);

		return {
			items: items.map((m) => ({
				id: m.id,
				contentType: m.contentType,
				blobSize: m.blobSize,
				context: m.context,
				createdAt: m.createdAt,
			})),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	// =========================================================================
	// Private helpers
	// =========================================================================

	private enforceContextSizeLimit(size: number, context: MediaContext): void {
		if (context === MediaContext.GROUP_ICON) {
			throw new NotImplementedException(
				'Group icon upload requires group admin authorization (not yet implemented)'
			);
		}
		const limit = CONTEXT_SIZE_LIMITS[context];
		if (size > limit) {
			throw new PayloadTooLargeException(
				`File size ${size} exceeds the ${limit} byte limit for context '${context}'`
			);
		}
	}

	private enforceReadAccess(context: MediaContext, ownerId: string, requesterId: string): void {
		if (!PUBLIC_CONTEXTS.has(context) && ownerId !== requesterId) {
			throw new ForbiddenException('Access denied');
		}
	}

	private async acquireSemaphore(userId: string): Promise<void> {
		const key = `upload:semaphore:${userId}`;
		// Atomic INCR: increment first, then check and reject if over limit
		const count = Number(await this.redisClient.incr(key));
		await this.redisClient.expire(key, SEMAPHORE_TTL_SECONDS);

		if (count > MAX_CONCURRENT_UPLOADS) {
			// Roll back the increment before rejecting
			await this.redisClient.decr(key);
			throw new HttpException(
				`You have reached the maximum of ${MAX_CONCURRENT_UPLOADS} concurrent uploads`,
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

	private async releaseSemaphore(userId: string): Promise<void> {
		const key = `upload:semaphore:${userId}`;
		const remaining = Number(await this.redisClient.decr(key));
		if (remaining <= 0) {
			await this.redisClient.del(key);
		}
	}

	private async runWithSemaphoreTtlRefresh<T>(userId: string, operation: () => Promise<T>): Promise<T> {
		const key = `upload:semaphore:${userId}`;
		const refresh = async () => {
			try {
				await this.redisClient.expire(key, SEMAPHORE_TTL_SECONDS);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`Failed to refresh upload semaphore TTL for user ${userId}: ${message}`);
			}
		};

		const interval = globalThis.setInterval(() => {
			void refresh();
		}, SEMAPHORE_TTL_REFRESH_INTERVAL_MS);
		interval.unref?.();

		try {
			return await operation();
		} finally {
			globalThis.clearInterval(interval);
		}
	}

	private async getOrGenerateSignedUrl(media: Media, manager: EntityManager): Promise<string> {
		if (PUBLIC_CONTEXTS.has(media.context)) {
			return this.storageService.getPublicUrl(media.storagePath);
		}

		const now = new Date();
		if (media.signedUrlExpiresAt && media.signedUrlExpiresAt > now) {
			const remaining = Math.max(
				1,
				Math.floor((media.signedUrlExpiresAt.getTime() - now.getTime()) / 1000)
			);
			return this.generatePresignedUrl(media.storagePath, remaining);
		}

		const expiresAt = new Date(now.getTime() + this.signedUrlExpirySeconds * 1000);
		const url = await this.generatePresignedUrl(media.storagePath, this.signedUrlExpirySeconds);
		await this.mediaRepository.updateSignedUrlExpiry(media.id, expiresAt, manager);
		return url;
	}

	private generatePresignedUrl(storagePath: string, expiresIn: number): Promise<string> {
		const command = new GetObjectCommand({
			Bucket: this.storageService.bucket,
			Key: storagePath,
		});
		return getSignedUrl(this.s3 as never, command, { expiresIn });
	}

	private contextToStorageContext(context: MediaContext): StorageContext {
		switch (context) {
			case MediaContext.AVATAR:
				return 'avatars';
			case MediaContext.GROUP_ICON:
				return 'group_icons';
			case MediaContext.MESSAGE:
			default:
				return 'messages';
		}
	}

	private computeExpiresAt(): Date {
		const ttlDays = this.configService.get<number>('MESSAGE_BLOB_TTL_DAYS', 30);
		return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
	}

	private buildUploadResponse(media: Media, _context: MediaContext): UploadMediaResponseDto {
		const url = media.storagePath ? this.storageService.getPublicUrl(media.storagePath) : null;
		const thumbnailUrl = media.thumbnailPath
			? this.storageService.getPublicUrl(media.thumbnailPath)
			: null;
		return {
			mediaId: media.id,
			url,
			thumbnailUrl,
			expiresAt: media.expiresAt,
			context: media.context as MediaContext,
			size: media.blobSize,
		};
	}

	private async writeAccessLog(
		mediaId: string,
		accessorId: string | null,
		accessType: string,
		ipAddress?: string,
		userAgent?: string
	): Promise<void> {
		const log = new MediaAccessLog();
		log.accessedAt = new Date();
		log.id = randomUUID();
		log.mediaId = mediaId;
		log.accessorId = accessorId;
		log.accessType = accessType;
		log.ipAddress = ipAddress ?? null;
		log.userAgent = userAgent?.slice(0, 512) ?? null;
		await this.accessLogRepo.save(log);
	}

	logAccess(mediaId: string, accessorId: string | null, accessType: string): void {
		const log = this.accessLogRepo.create({
			mediaId,
			accessorId,
			accessType,
			accessedAt: new Date(),
		});

		this.accessLogRepo.save(log).catch((error: unknown) => {
			const msg = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to write access log for media ${mediaId}: ${msg}`);
		});
	}
}

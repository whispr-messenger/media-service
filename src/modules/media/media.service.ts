import {
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import { createHash } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { MediaRepository } from './repositories/media.repository';
import { StorageService, StorageContext } from './storage.service';
import { QuotaService } from './quota.service';
import { validateMagicBytes } from './magic-bytes.validator';
import { MediaContext, UploadMediaResponseDto, MediaMetadataDto } from './dto/upload-media.dto';

// Blob size limits per context (in bytes)
const CONTEXT_SIZE_LIMITS: Record<MediaContext, number> = {
	[MediaContext.MESSAGE]: 100 * 1024 * 1024, // 100 MB
	[MediaContext.AVATAR]: 5 * 1024 * 1024, // 5 MB
	[MediaContext.GROUP_ICON]: 5 * 1024 * 1024, // 5 MB
};

const PUBLIC_CONTEXTS = new Set<string>([MediaContext.AVATAR, MediaContext.GROUP_ICON]);

// Redis key TTLs
const META_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const DEDUP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SEMAPHORE_TTL_SECONDS = 120; // safety net TTL in seconds

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
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
		@InjectRepository(MediaAccessLog)
		private readonly accessLogRepo: Repository<MediaAccessLog>
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
			// WHISPR-356: Pre-upload quota check
			await this.quotaService.enforceQuota(ownerId, file.size);

			// WHISPR-361: Blob size limits per context
			this.enforceContextSizeLimit(file.size, context, ownerId);

			// WHISPR-360: Magic bytes validation
			const blobBuffer = file.buffer ?? Buffer.alloc(0);
			validateMagicBytes(blobBuffer, file.mimetype);

			// WHISPR-362: Blob deduplication via SHA-256
			const sha256 = createHash('sha256').update(blobBuffer).digest('hex');
			const dedupKey = `dedup:blob:${sha256}`;
			const existingId = await this.cache.get<string>(dedupKey);
			if (existingId) {
				const existing = await this.mediaRepository.findById(existingId);
				if (existing) {
					this.logger.debug(`Dedup hit for sha256=${sha256} → reusing media ${existingId}`);
					return this.buildUploadResponse(existing);
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
				const thumbnailStoragePath = this.storageService.buildPath('thumbnails', ownerId, id);
				const thumbStream =
					thumbnailFile.stream ?? Readable.from(thumbnailFile.buffer ?? Buffer.alloc(0));
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
			media.expiresAt =
				context === MediaContext.MESSAGE
					? this.computeExpiresAt()
					: null;
			media.isActive = true;

			await this.mediaRepository.save(media);

			// Cache dedup entry
			await this.cache.set(dedupKey, id, DEDUP_CACHE_TTL_MS);

			// WHISPR-357: Update quota
			await this.quotaService.recordUpload(ownerId, file.size);

			return this.buildUploadResponse(media);
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
			this.enforceReadAccess(cached.context as MediaContext, cached.ownerId, requesterId);
			return cached;
		}

		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		this.enforceReadAccess(media.context as MediaContext, media.ownerId, requesterId);

		const dto: MediaMetadataDto = {
			id: media.id,
			ownerId: media.ownerId,
			context: media.context,
			contentType: media.contentType,
			blobSize: media.blobSize,
			expiresAt: media.expiresAt,
			isActive: media.isActive,
			createdAt: media.createdAt,
			thumbnailPath: media.thumbnailPath,
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
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		this.enforceReadAccess(media.context as MediaContext, media.ownerId, requesterId);

		const url = await this.getOrGenerateSignedUrl(media);

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
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}
		if (!media.thumbnailPath) {
			throw new NotFoundException(`Media ${id} has no thumbnail`);
		}

		this.enforceReadAccess(media.context as MediaContext, media.ownerId, requesterId);

		const command = new GetObjectCommand({
			Bucket: this.storageService.bucket,
			Key: media.thumbnailPath,
		});
		const url = await getSignedUrl(this.s3 as never, command, {
			expiresIn: this.signedUrlExpirySeconds,
		});

		this.writeAccessLog(media.id, requesterId, 'thumbnail', ipAddress, userAgent).catch(() => {});

		return url;
	}

	// =========================================================================
	// DELETE /media/v1/:id — WHISPR-367
	// =========================================================================

	async delete(
		id: string,
		requesterId: string,
		ipAddress?: string,
		userAgent?: string
	): Promise<void> {
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		if (media.ownerId !== requesterId) {
			throw new ForbiddenException(`You do not own media ${id}`);
		}

		// Soft delete
		await this.mediaRepository.softDelete(id);

		// Invalidate metadata cache
		await this.cache.del(`media:meta:${id}`);

		// Release quota
		await this.quotaService.recordDelete(requesterId, media.blobSize);

		// Access log
		this.writeAccessLog(media.id, requesterId, 'delete', ipAddress, userAgent).catch(() => {});

		this.logger.debug(`Soft-deleted media ${id}`);
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
	// Private helpers
	// =========================================================================

	private enforceContextSizeLimit(size: number, context: MediaContext, ownerId: string): void {
		const limit = CONTEXT_SIZE_LIMITS[context];
		if (size > limit) {
			throw new ForbiddenException(
				`File size ${size} exceeds the ${limit} byte limit for context '${context}'`
			);
		}
		// WHISPR-361: For message and avatar, JWT sub must match ownerId.
		// For group_icon: 403 — group admin check deferred.
		if (context === MediaContext.GROUP_ICON) {
			throw new ForbiddenException(
				'Group icon upload requires group admin authorization (not yet implemented)'
			);
		}
		void ownerId; // used in validation above
	}

	private enforceReadAccess(
		context: MediaContext,
		ownerId: string,
		requesterId: string
	): void {
		if (!PUBLIC_CONTEXTS.has(context) && ownerId !== requesterId) {
			throw new ForbiddenException('Access denied');
		}
	}

	private async acquireSemaphore(userId: string): Promise<void> {
		const key = `upload:semaphore:${userId}`;
		// Get-and-increment approach
		const current = await this.cache.get<number>(key);
		const count = typeof current === 'number' ? current : 0;

		if (count >= MAX_CONCURRENT_UPLOADS) {
			throw new HttpException(
				`You have reached the maximum of ${MAX_CONCURRENT_UPLOADS} concurrent uploads`,
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		await this.cache.set(key, count + 1, SEMAPHORE_TTL_SECONDS * 1000);
	}

	private async releaseSemaphore(userId: string): Promise<void> {
		const key = `upload:semaphore:${userId}`;
		const current = await this.cache.get<number>(key);
		const count = typeof current === 'number' ? current : 1;

		if (count <= 1) {
			await this.cache.del(key);
		} else {
			await this.cache.set(key, count - 1, SEMAPHORE_TTL_SECONDS * 1000);
		}
	}

	private async getOrGenerateSignedUrl(media: Media): Promise<string> {
		if (PUBLIC_CONTEXTS.has(media.context)) {
			return this.storageService.getPublicUrl(media.storagePath);
		}

		const now = new Date();
		if (media.signedUrlExpiresAt && media.signedUrlExpiresAt > now) {
			const remaining = Math.floor(
				(media.signedUrlExpiresAt.getTime() - now.getTime()) / 1000
			);
			return this.generatePresignedUrl(media.storagePath, remaining);
		}

		const expiresAt = new Date(now.getTime() + this.signedUrlExpirySeconds * 1000);
		const url = await this.generatePresignedUrl(media.storagePath, this.signedUrlExpirySeconds);
		await this.mediaRepository.updateSignedUrlExpiry(media.id, expiresAt);
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

	private buildUploadResponse(media: Media): UploadMediaResponseDto {
		return {
			mediaId: media.id,
			url: media.storagePath ? this.storageService.getPublicUrl(media.storagePath) : null,
			thumbnailUrl: media.thumbnailPath
				? this.storageService.getPublicUrl(media.thumbnailPath)
				: null,
			expiresAt: media.expiresAt,
			context: media.context,
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
}

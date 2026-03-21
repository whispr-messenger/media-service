import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { randomUUID } from 'crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { Media } from './entities/media.entity';
import { MediaRepository } from './repositories/media.repository';
import { StorageService, StorageContext } from './storage.service';

const PUBLIC_CONTEXTS = new Set(['avatars', 'group_icons']);

@Injectable()
export class MediaService {
	private readonly logger = new Logger(MediaService.name);
	private readonly signedUrlExpirySeconds: number;

	constructor(
		private readonly mediaRepository: MediaRepository,
		private readonly storageService: StorageService,
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService
	) {
		this.signedUrlExpirySeconds = this.configService.get<number>(
			'SIGNED_URL_EXPIRY_SECONDS',
			7 * 24 * 60 * 60
		);
	}

	async upload(ownerId: string, file: Express.Multer.File, context: string): Promise<Media> {
		const id = randomUUID();
		const storageContext = this.resolveContext(context);
		const storagePath = this.storageService.buildPath(storageContext, ownerId, id);

		this.logger.debug(`Uploading file ${file.originalname} to ${storagePath}`);

		const stream: Readable = file.stream ?? Readable.from(file.buffer);
		await this.storageService.upload(storagePath, stream, file.mimetype, file.size);

		const media = new Media();
		media.id = id;
		media.ownerId = ownerId;
		media.context = context;
		media.storagePath = storagePath;
		media.thumbnailPath = null;
		media.contentType = file.mimetype;
		media.blobSize = file.size;
		media.expiresAt = null;
		media.isActive = true;

		return this.mediaRepository.save(media);
	}

	async getDownloadUrl(id: string): Promise<string> {
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		if (PUBLIC_CONTEXTS.has(media.context)) {
			return this.storageService.getPublicUrl(media.storagePath);
		}

		const now = new Date();
		if (media.signedUrlExpiresAt && media.signedUrlExpiresAt > now) {
			const remainingSeconds = Math.floor((media.signedUrlExpiresAt.getTime() - now.getTime()) / 1000);
			return this.generatePresignedUrl(media.storagePath, remainingSeconds);
		}

		const expiresAt = new Date(now.getTime() + this.signedUrlExpirySeconds * 1000);
		const url = await this.generatePresignedUrl(media.storagePath, this.signedUrlExpirySeconds);
		await this.mediaRepository.updateSignedUrlExpiry(id, expiresAt);

		return url;
	}

	private generatePresignedUrl(storagePath: string, expiresIn: number): Promise<string> {
		const command = new GetObjectCommand({
			Bucket: this.storageService.bucket,
			Key: storagePath,
		});
		return getSignedUrl(this.s3 as never, command, { expiresIn });
	}

	async getStream(id: string): Promise<{ stream: Readable; contentType: string }> {
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		const stream = await this.storageService.download(media.storagePath);

		return {
			stream,
			contentType: media.contentType,
		};
	}

	async delete(id: string, requesterId: string): Promise<void> {
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		if (media.ownerId !== requesterId) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		await this.storageService.delete(media.storagePath);
		await this.mediaRepository.softDelete(id);
		this.logger.debug(`Deleted media ${id}`);
	}

	private resolveContext(context: string): StorageContext {
		switch (context) {
			case 'messages':
			case 'avatars':
			case 'group_icons':
			case 'thumbnails':
				return context;
			default:
				return 'messages';
		}
	}
}

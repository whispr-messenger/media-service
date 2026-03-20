import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { randomUUID } from 'crypto';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { Media } from './entities/media.entity';
import { MediaRepository } from './repositories/media.repository';

@Injectable()
export class MediaService {
	private readonly logger = new Logger(MediaService.name);
	private readonly bucket: string;
	private readonly presignedUrlTtl: number;

	constructor(
		private readonly mediaRepository: MediaRepository,
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService
	) {
		this.bucket = this.configService.get<string>('S3_BUCKET', 'whispr-media');
		this.presignedUrlTtl = this.configService.get<number>('PRESIGNED_URL_TTL_SECONDS', 3600);
	}

	async upload(ownerId: string, file: Express.Multer.File, context: string): Promise<Media> {
		const id = randomUUID();
		const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : '';
		const storagePath = ext ? `${ownerId}/${id}.${ext}` : `${ownerId}/${id}`;

		this.logger.debug(`Uploading file ${file.originalname} to ${storagePath}`);

		await this.s3.putObject({
			Bucket: this.bucket,
			Key: storagePath,
			Body: file.buffer,
			ContentType: file.mimetype,
		});

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

		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: media.storagePath,
		});

		return getSignedUrl(this.s3 as never, command, { expiresIn: this.presignedUrlTtl });
	}

	async getStream(id: string): Promise<{ stream: Readable; contentType: string }> {
		const media = await this.mediaRepository.findById(id);
		if (!media) {
			throw new NotFoundException(`Media ${id} not found`);
		}

		const response = await this.s3.getObject({
			Bucket: this.bucket,
			Key: media.storagePath,
		});

		return {
			stream: response.Body as Readable,
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

		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: media.storagePath,
			})
		);

		await this.mediaRepository.softDelete(id);
		this.logger.debug(`Deleted media ${id}`);
	}
}

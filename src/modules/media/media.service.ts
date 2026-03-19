import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { randomUUID } from 'crypto';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { MediaFile } from './entities/media-file.entity';
import { MediaFileRepository } from './repositories/media-file.repository';

@Injectable()
export class MediaService {
	private readonly logger = new Logger(MediaService.name);
	private readonly bucket: string;
	private readonly presignedUrlTtl: number;

	constructor(
		private readonly mediaFileRepository: MediaFileRepository,
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService
	) {
		this.bucket = this.configService.get<string>('S3_BUCKET', 'whispr-media');
		this.presignedUrlTtl = this.configService.get<number>('PRESIGNED_URL_TTL_SECONDS', 3600);
	}

	async upload(uploaderId: string, file: Express.Multer.File): Promise<MediaFile> {
		const id = randomUUID();
		const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : '';
		const storageKey = ext ? `${uploaderId}/${id}.${ext}` : `${uploaderId}/${id}`;

		this.logger.debug(`Uploading file ${file.originalname} to ${storageKey}`);

		await this.s3.putObject({
			Bucket: this.bucket,
			Key: storageKey,
			Body: file.buffer,
			ContentType: file.mimetype,
		});

		const mediaFile = new MediaFile();
		mediaFile.id = id;
		mediaFile.uploaderId = uploaderId;
		mediaFile.filename = file.originalname;
		mediaFile.storageKey = storageKey;
		mediaFile.mimeType = file.mimetype;
		mediaFile.size = file.size;

		return this.mediaFileRepository.save(mediaFile);
	}

	async getDownloadUrl(id: string): Promise<string> {
		const mediaFile = await this.mediaFileRepository.findById(id);
		if (!mediaFile) {
			throw new NotFoundException(`Media file ${id} not found`);
		}

		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: mediaFile.storageKey,
		});

		return getSignedUrl(this.s3 as never, command, { expiresIn: this.presignedUrlTtl });
	}

	async getStream(id: string): Promise<{ stream: Readable; mimeType: string; filename: string }> {
		const mediaFile = await this.mediaFileRepository.findById(id);
		if (!mediaFile) {
			throw new NotFoundException(`Media file ${id} not found`);
		}

		const response = await this.s3.getObject({
			Bucket: this.bucket,
			Key: mediaFile.storageKey,
		});

		return {
			stream: response.Body as Readable,
			mimeType: mediaFile.mimeType,
			filename: mediaFile.filename,
		};
	}

	async delete(id: string, requesterId: string): Promise<void> {
		const mediaFile = await this.mediaFileRepository.findById(id);
		if (!mediaFile) {
			throw new NotFoundException(`Media file ${id} not found`);
		}

		if (mediaFile.uploaderId !== requesterId) {
			throw new NotFoundException(`Media file ${id} not found`);
		}

		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: mediaFile.storageKey,
			})
		);

		await this.mediaFileRepository.softDelete(id);
		this.logger.debug(`Deleted media file ${id}`);
	}
}

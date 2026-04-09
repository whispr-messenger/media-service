import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export type StorageContext = 'messages' | 'avatars' | 'group_icons' | 'thumbnails';

@Injectable()
export class StorageService {
	private readonly logger = new Logger(StorageService.name);
	readonly bucket: string;
	private readonly forcePathStyle: boolean;
	private readonly endpoint: string;

	constructor(
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService
	) {
		this.bucket = this.configService.get<string>('S3_BUCKET', 'whispr-media');
		this.forcePathStyle = this.configService.get<boolean>('S3_FORCE_PATH_STYLE', false);
		this.endpoint = this.configService.get<string>('S3_ENDPOINT', '');
	}

	getPublicUrl(storagePath: string): string {
		if (this.forcePathStyle) {
			return `${this.endpoint}/${this.bucket}/${storagePath}`;
		}
		const url = new URL(this.endpoint);
		return `${url.protocol}//${this.bucket}.${url.host}/${storagePath}`;
	}

	buildPath(context: StorageContext, ownerId: string, objectId: string): string {
		switch (context) {
			case 'messages':
				return `messages/${ownerId}/${objectId}.bin`;
			case 'avatars':
				return `avatars/${ownerId}/${objectId}`;
			case 'group_icons':
				return `group_icons/${ownerId}/${objectId}`;
			case 'thumbnails':
				return `thumbnails/${objectId}.bin`;
			default:
				throw new Error(`Unknown storage context: ${context as string}`);
		}
	}

	async upload(
		storagePath: string,
		stream: Readable,
		contentType: string,
		contentLength?: number
	): Promise<void> {
		this.logger.debug(`Uploading to ${storagePath}`);
		await this.s3.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: storagePath,
				Body: stream,
				ContentType: contentType,
				...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
			})
		);
	}

	async download(storagePath: string): Promise<Readable> {
		this.logger.debug(`Downloading from ${storagePath}`);
		const response = await this.s3.getObject({
			Bucket: this.bucket,
			Key: storagePath,
		});
		return response.Body as Readable;
	}

	async delete(storagePath: string): Promise<void> {
		this.logger.debug(`Deleting ${storagePath}`);
		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: storagePath,
			})
		);
	}

	async exists(storagePath: string): Promise<boolean> {
		try {
			await this.s3.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: storagePath,
				})
			);
			return true;
		} catch {
			return false;
		}
	}
}

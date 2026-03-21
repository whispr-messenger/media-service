import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export type StorageContext = 'messages' | 'avatars' | 'group_icons' | 'thumbnails';

@Injectable()
export class StorageService {
	private readonly logger = new Logger(StorageService.name);
	readonly bucket: string;

	constructor(
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService
	) {
		this.bucket = this.configService.get<string>('S3_BUCKET', 'whispr-media');
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
}

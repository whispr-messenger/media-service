import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum MediaContext {
	MESSAGE = 'message',
	AVATAR = 'avatar',
	GROUP_ICON = 'group_icon',
}

export class UploadMediaDto {
	@ApiPropertyOptional({ description: 'Upload context', enum: MediaContext })
	@IsOptional()
	@IsEnum(MediaContext)
	context?: MediaContext;

	@ApiPropertyOptional({ description: 'UUID of the resource owner' })
	@IsOptional()
	@IsUUID()
	ownerId?: string;
}

export class UploadMediaResponseDto {
	@ApiProperty({ description: 'Unique identifier of the uploaded media' })
	mediaId: string;

	@ApiPropertyOptional({ description: 'Presigned URL or public URL for the blob' })
	url: string | null;

	@ApiPropertyOptional({ description: 'Presigned URL for the thumbnail' })
	thumbnailUrl: string | null;

	@ApiPropertyOptional({ description: 'Expiry timestamp for message blobs' })
	expiresAt: Date | null;

	@ApiProperty({ description: 'Upload context', enum: MediaContext })
	context: MediaContext;

	@ApiProperty({ description: 'Blob size in bytes' })
	size: number;
}

export class MediaMetadataDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	ownerId: string;

	@ApiProperty({ enum: MediaContext })
	context: MediaContext;

	@ApiProperty()
	contentType: string;

	@ApiProperty()
	blobSize: number;

	@ApiPropertyOptional()
	expiresAt: Date | null;

	@ApiProperty()
	isActive: boolean;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	hasThumbnail: boolean;
}

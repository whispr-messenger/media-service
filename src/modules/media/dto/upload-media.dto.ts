import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export enum MediaContext {
	MESSAGE = 'message',
	AVATAR = 'avatar',
	GROUP_ICON = 'group_icon',
}

export class UploadMediaDto {
	@ApiProperty({ description: 'Upload context', enum: MediaContext })
	@IsEnum(MediaContext)
	context: MediaContext;

	@ApiProperty({ description: 'UUID of the resource owner' })
	@IsUUID()
	@IsNotEmpty()
	ownerId: string;
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
	context: string;

	@ApiProperty({ description: 'Blob size in bytes' })
	size: number;
}

export class MediaMetadataDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	ownerId: string;

	@ApiProperty({ enum: MediaContext })
	context: string;

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

	@ApiPropertyOptional()
	thumbnailPath: string | null;
}

import { ApiProperty } from '@nestjs/swagger';

export class MediaItemDto {
	@ApiProperty({ description: 'Unique identifier of the media' })
	id: string;

	@ApiProperty({ description: 'MIME type of the file' })
	contentType: string;

	@ApiProperty({ description: 'File size in bytes' })
	blobSize: number;

	@ApiProperty({ description: 'Storage context (messages, avatars, etc.)' })
	context: string;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;
}

export class PaginatedMediaResponseDto {
	@ApiProperty({ description: 'List of media items', type: [MediaItemDto] })
	items: MediaItemDto[];

	@ApiProperty({ description: 'Total number of items' })
	total: number;

	@ApiProperty({ description: 'Current page number' })
	page: number;

	@ApiProperty({ description: 'Items per page' })
	limit: number;

	@ApiProperty({ description: 'Total number of pages' })
	totalPages: number;
}

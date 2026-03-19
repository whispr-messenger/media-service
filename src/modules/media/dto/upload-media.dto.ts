import { ApiProperty } from '@nestjs/swagger';

export class UploadMediaResponseDto {
	@ApiProperty({ description: 'Unique identifier of the uploaded media file' })
	id: string;

	@ApiProperty({ description: 'Original filename' })
	filename: string;

	@ApiProperty({ description: 'MIME type of the file' })
	mimeType: string;

	@ApiProperty({ description: 'File size in bytes' })
	size: number;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;
}

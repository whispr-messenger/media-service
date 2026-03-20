import { ApiProperty } from '@nestjs/swagger';

export class UploadMediaResponseDto {
	@ApiProperty({ description: 'Unique identifier of the uploaded media' })
	id: string;

	@ApiProperty({ description: 'MIME type of the file' })
	contentType: string;

	@ApiProperty({ description: 'File size in bytes' })
	blobSize: number;

	@ApiProperty({ description: 'Creation timestamp' })
	createdAt: Date;
}

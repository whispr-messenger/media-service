import { ApiProperty } from '@nestjs/swagger';

export class UserQuotaResponseDto {
	@ApiProperty({ description: 'Storage used in bytes' })
	storageUsed: number;

	@ApiProperty({ description: 'Storage limit in bytes' })
	storageLimit: number;

	@ApiProperty({ description: 'Number of files uploaded' })
	filesCount: number;

	@ApiProperty({ description: 'Maximum number of files allowed' })
	filesLimit: number;

	@ApiProperty({ description: 'Number of uploads today' })
	dailyUploads: number;

	@ApiProperty({ description: 'Maximum daily uploads allowed' })
	dailyUploadLimit: number;

	@ApiProperty({ description: 'Quota date (YYYY-MM-DD)', nullable: true })
	quotaDate: string | null;

	@ApiProperty({ description: 'Storage usage percentage (0-100)' })
	usagePercent: number;
}

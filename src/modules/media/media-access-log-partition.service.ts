import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MediaAccessLogPartitionService {
	private readonly logger = new Logger(MediaAccessLogPartitionService.name);

	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	@Cron('0 0 1 * *')
	async createNextMonthPartition(): Promise<void> {
		const now = new Date();
		const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
		const monthAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

		const partitionName = this.formatPartitionName(nextMonth);
		const fromDate = this.formatDate(nextMonth);
		const toDate = this.formatDate(monthAfter);

		this.logger.log(`Creating partition ${partitionName} for range [${fromDate}, ${toDate})`);

		await this.dataSource.query(`
			CREATE TABLE IF NOT EXISTS "media"."${partitionName}"
			PARTITION OF "media"."media_access_logs"
			FOR VALUES FROM ('${fromDate}') TO ('${toDate}')
		`);

		this.logger.log(`Partition ${partitionName} ready`);
	}

	private formatPartitionName(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		return `media_access_logs_${year}_${month}`;
	}

	private formatDate(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		return `${year}-${month}-01`;
	}
}

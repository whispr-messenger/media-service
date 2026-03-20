import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const ADVISORY_LOCK_KEY = 350001;

@Injectable()
export class MediaAccessLogPartitionService {
	private readonly logger = new Logger(MediaAccessLogPartitionService.name);

	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	@Cron('0 0 1 * *', { timeZone: 'UTC' })
	async createNextMonthPartition(): Promise<void> {
		const now = new Date();
		const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
		const monthAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

		const partitionName = this.formatPartitionName(nextMonth);
		const fromDate = this.formatTimestamp(nextMonth);
		const toDate = this.formatTimestamp(monthAfter);

		const [{ pg_try_advisory_lock: acquired }] = await this.dataSource.query(
			`SELECT pg_try_advisory_lock($1)`,
			[ADVISORY_LOCK_KEY]
		);

		if (!acquired) {
			this.logger.log(`Partition creation skipped — another instance holds the advisory lock`);
			return;
		}

		try {
			this.logger.log(`Creating partition ${partitionName} for range [${fromDate}, ${toDate})`);

			await this.dataSource.query(`
				CREATE TABLE IF NOT EXISTS "media"."${partitionName}"
				PARTITION OF "media"."media_access_logs"
				FOR VALUES FROM ('${fromDate}') TO ('${toDate}')
			`);

			this.logger.log(`Partition ${partitionName} ready`);
		} finally {
			await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
		}
	}

	private formatPartitionName(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		return `media_access_logs_${year}_${month}`;
	}

	private formatTimestamp(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		return `${year}-${month}-01 00:00:00+00`;
	}
}

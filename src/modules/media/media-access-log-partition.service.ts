import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const ADVISORY_LOCK_KEY = 350001;

@Injectable()
export class MediaAccessLogPartitionService implements OnApplicationBootstrap {
	private readonly logger = new Logger(MediaAccessLogPartitionService.name);

	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	/**
	 * Crée la partition du mois courant au démarrage si elle est absente.
	 * Le cron ci-dessous crée uniquement le mois suivant le 1er de chaque mois,
	 * ce qui laisse un trou lors du premier déploiement après changement de mois
	 * (les écritures tombent alors dans la partition _default non purgée).
	 */
	async onApplicationBootstrap(): Promise<void> {
		try {
			const now = new Date();
			await this.ensurePartitionForMonth(now);
		} catch (err) {
			// Non-bloquant : on log et on laisse l'app démarrer normalement.
			this.logger.warn(
				`Bootstrap partition check failed: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}

	@Cron('0 0 1 * *', { timeZone: 'UTC' })
	async createNextMonthPartition(): Promise<void> {
		const now = new Date();
		const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
		await this.ensurePartitionForMonth(nextMonth);
	}

	/**
	 * Crée (si absente) la partition couvrant le mois de `date`.
	 * Protégé par un advisory lock pour éviter les créations concurrentes
	 * en environnement multi-replica.
	 */
	async ensurePartitionForMonth(date: Date): Promise<void> {
		const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
		const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

		const partitionName = this.formatPartitionName(start);
		const fromDate = this.formatTimestamp(start);
		const toDate = this.formatTimestamp(end);

		const [{ pg_try_advisory_lock: acquired }] = await this.dataSource.query(
			`SELECT pg_try_advisory_lock($1)`,
			[ADVISORY_LOCK_KEY]
		);

		if (!acquired) {
			this.logger.log(`Partition creation skipped - another instance holds the advisory lock`);
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

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
	DataSource,
	EntitySubscriberInterface,
	EventSubscriber,
	TransactionStartEvent,
} from 'typeorm';
import { RlsContextService } from './rls-context.service';

/**
 * TypeORM entity subscriber that fires `SET LOCAL "app.current_user_id" = '…'`
 * at the beginning of every transaction.
 *
 * Using SET LOCAL ensures the GUC is scoped to the transaction only and
 * cannot leak across connections in the pool when the connection is returned.
 *
 * The user ID is sourced from the request-scoped {@link RlsContextService}
 * via AsyncLocalStorage, so no constructor injection of the request is needed.
 *
 * ### Required role setup
 * The application DB role must NOT be a superuser (superusers bypass RLS).
 * Create a dedicated role:
 *
 * ```sql
 * CREATE ROLE media_app LOGIN PASSWORD '...' NOSUPERUSER;
 * GRANT USAGE ON SCHEMA media TO media_app;
 * GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA media TO media_app;
 * ALTER ROLE media_app SET search_path = media;
 * ```
 */
@Injectable()
@EventSubscriber()
export class RlsSubscriber implements EntitySubscriberInterface {
	private readonly logger = new Logger(RlsSubscriber.name);

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly rlsContext: RlsContextService
	) {
		dataSource.subscribers.push(this);
	}

	async afterTransactionStart(event: TransactionStartEvent): Promise<void> {
		const userId = this.rlsContext.getCurrentUserId();
		if (!userId) {
			return;
		}

		try {
			await event.queryRunner.query(`SET LOCAL "app.current_user_id" = '${userId}'`);
		} catch (error) {
			this.logger.error(`Failed to set app.current_user_id GUC: ${(error as Error).message}`);
		}
	}
}

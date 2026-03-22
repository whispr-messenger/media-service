import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, EventSubscriber, TransactionStartEvent } from 'typeorm';
import { RlsContextService } from './rls-context.service';

/**
 * TypeORM entity subscriber that fires `set_config('app.current_user_id', …, true)`
 * at the beginning of every transaction.
 *
 * Using `set_config` with `is_local = true` ensures the GUC is scoped to the
 * current transaction only and cannot leak across connections in the pool when
 * the connection is returned.
 *
 * **Important:** `SET LOCAL` (and `set_config(…, true)`) only take effect
 * inside an explicit transaction. This subscriber hooks into
 * `afterTransactionStart`, so it is guaranteed to run within a transaction
 * context. For queries that do **not** use an explicit transaction (e.g. plain
 * `findOne`, `update`), the GUC will NOT be set. Wrap such operations in
 * `dataSource.transaction(…)` or `queryRunner.startTransaction()` if RLS
 * filtering is required.
 *
 * The user ID is sourced from the {@link RlsContextService} which uses
 * AsyncLocalStorage per-request state, so no constructor injection of the
 * request is needed.
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
			await event.queryRunner.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to set app.current_user_id GUC: ${err.message}`, err.stack);
			throw error;
		}
	}
}

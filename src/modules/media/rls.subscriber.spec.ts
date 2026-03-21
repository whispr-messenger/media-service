import { RlsSubscriber } from './rls.subscriber';
import { RlsContextService } from './rls-context.service';
import { DataSource } from 'typeorm';
import type { TransactionStartEvent } from 'typeorm';

const makeDataSource = (): DataSource => ({ subscribers: [] }) as unknown as DataSource;

const makeEvent = (): TransactionStartEvent =>
	({ queryRunner: { query: jest.fn() } }) as unknown as TransactionStartEvent;

describe('RlsSubscriber', () => {
	let rlsContext: RlsContextService;
	let subscriber: RlsSubscriber;
	let dataSource: DataSource;

	beforeEach(() => {
		rlsContext = new RlsContextService();
		dataSource = makeDataSource();
		subscriber = new RlsSubscriber(dataSource, rlsContext);
	});

	it('pushes itself into dataSource.subscribers on construction', () => {
		expect(dataSource.subscribers).toContain(subscriber);
	});

	it('does NOT run SET LOCAL when no userId is in context', async () => {
		const event = makeEvent();
		await subscriber.afterTransactionStart(event);
		expect(event.queryRunner.query).not.toHaveBeenCalled();
	});

	it('runs SET LOCAL with the correct userId when context is set', async () => {
		const userId = '550e8400-e29b-41d4-a716-446655440000';
		const event = makeEvent();

		await rlsContext.run(userId, async () => {
			await subscriber.afterTransactionStart(event);
		});

		expect(event.queryRunner.query).toHaveBeenCalledWith(`SET LOCAL "app.current_user_id" = '${userId}'`);
	});

	it('does not throw if the query fails — it only logs the error', async () => {
		const userId = '550e8400-e29b-41d4-a716-446655440000';
		const event = makeEvent();
		(event.queryRunner.query as jest.Mock).mockRejectedValueOnce(new Error('db error'));

		await expect(
			rlsContext.run(userId, async () => subscriber.afterTransactionStart(event))
		).resolves.toBeUndefined();
	});
});

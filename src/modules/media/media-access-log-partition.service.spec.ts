import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MediaAccessLogPartitionService } from './media-access-log-partition.service';

describe('MediaAccessLogPartitionService', () => {
	let service: MediaAccessLogPartitionService;
	let queryMock: jest.Mock;

	beforeEach(async () => {
		queryMock = jest.fn().mockImplementation((sql: string) => {
			if (sql.includes('pg_try_advisory_lock'))
				return Promise.resolve([{ pg_try_advisory_lock: true }]);
			return Promise.resolve(undefined);
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MediaAccessLogPartitionService,
				{
					provide: getDataSourceToken(),
					useValue: { query: queryMock },
				},
			],
		}).compile();

		service = module.get(MediaAccessLogPartitionService);
	});

	afterEach(() => jest.useRealTimers());

	it('creates a partition for the next calendar month', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-01T00:00:00Z'));

		await service.createNextMonthPartition();

		const ddlCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('CREATE TABLE'));
		expect(ddlCall).toBeDefined();
		const sql: string = ddlCall[0];
		expect(sql).toContain('media_access_logs_2026_04');
		expect(sql).toContain("'2026-04-01 00:00:00+00'");
		expect(sql).toContain("'2026-05-01 00:00:00+00'");
	});

	it('handles year rollover correctly (December → January)', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-12-01T00:00:00Z'));

		await service.createNextMonthPartition();

		const ddlCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('CREATE TABLE'));
		const sql: string = ddlCall[0];
		expect(sql).toContain('media_access_logs_2027_01');
		expect(sql).toContain("'2027-01-01 00:00:00+00'");
		expect(sql).toContain("'2027-02-01 00:00:00+00'");
	});

	it('uses IF NOT EXISTS to avoid duplicate partition errors', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-15T00:00:00Z'));

		await service.createNextMonthPartition();

		const ddlCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('CREATE TABLE'));
		expect(ddlCall[0]).toMatch(/CREATE TABLE IF NOT EXISTS/i);
	});

	it('skips partition creation when advisory lock is not acquired', async () => {
		queryMock.mockImplementation((sql: string) => {
			if (sql.includes('pg_try_advisory_lock'))
				return Promise.resolve([{ pg_try_advisory_lock: false }]);
			return Promise.resolve(undefined);
		});

		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-01T00:00:00Z'));

		await service.createNextMonthPartition();

		const ddlCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('CREATE TABLE'));
		expect(ddlCall).toBeUndefined();
	});

	it('releases the advisory lock after partition creation', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-01T00:00:00Z'));

		await service.createNextMonthPartition();

		const unlockCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('pg_advisory_unlock'));
		expect(unlockCall).toBeDefined();
	});

	it('releases the advisory lock even if partition creation fails', async () => {
		queryMock.mockImplementation((sql: string) => {
			if (sql.includes('pg_try_advisory_lock'))
				return Promise.resolve([{ pg_try_advisory_lock: true }]);
			if (sql.includes('CREATE TABLE')) return Promise.reject(new Error('DDL failed'));
			return Promise.resolve(undefined);
		});

		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-01T00:00:00Z'));

		await expect(service.createNextMonthPartition()).rejects.toThrow('DDL failed');

		const unlockCall = queryMock.mock.calls.find(([sql]: [string]) => sql.includes('pg_advisory_unlock'));
		expect(unlockCall).toBeDefined();
	});
});

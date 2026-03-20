import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MediaAccessLogPartitionService } from './media-access-log-partition.service';

describe('MediaAccessLogPartitionService', () => {
	let service: MediaAccessLogPartitionService;
	let queryMock: jest.Mock;

	beforeEach(async () => {
		queryMock = jest.fn().mockResolvedValue(undefined);

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

	it('creates a partition for the next calendar month', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-01T00:00:00Z'));

		await service.createNextMonthPartition();

		expect(queryMock).toHaveBeenCalledTimes(1);
		const sql: string = queryMock.mock.calls[0][0];
		expect(sql).toContain('media_access_logs_2026_04');
		expect(sql).toContain("'2026-04-01'");
		expect(sql).toContain("'2026-05-01'");

		jest.useRealTimers();
	});

	it('handles year rollover correctly (December → January)', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-12-01T00:00:00Z'));

		await service.createNextMonthPartition();

		const sql: string = queryMock.mock.calls[0][0];
		expect(sql).toContain('media_access_logs_2027_01');
		expect(sql).toContain("'2027-01-01'");
		expect(sql).toContain("'2027-02-01'");

		jest.useRealTimers();
	});

	it('uses IF NOT EXISTS to avoid duplicate partition errors', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-15T00:00:00Z'));

		await service.createNextMonthPartition();

		const sql: string = queryMock.mock.calls[0][0];
		expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/i);

		jest.useRealTimers();
	});
});

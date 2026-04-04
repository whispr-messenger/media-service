import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { UserQuota } from './entities/user-quota.entity';
import {
	DEFAULT_STORAGE_LIMIT_BYTES,
	DEFAULT_FILES_LIMIT,
	DEFAULT_DAILY_UPLOAD_LIMIT,
} from './quota.constants';
import { REDIS_CLIENT } from './media.tokens';

const makeQuota = (overrides: Partial<UserQuota> = {}): UserQuota =>
	({
		id: 'quota-id-1',
		userId: 'user-1',
		storageUsed: 0n,
		storageLimit: BigInt(DEFAULT_STORAGE_LIMIT_BYTES),
		filesCount: 0,
		filesLimit: DEFAULT_FILES_LIMIT,
		dailyUploads: 0,
		dailyUploadLimit: DEFAULT_DAILY_UPLOAD_LIMIT,
		quotaDate: '2026-03-21',
		updatedAt: new Date(),
		...overrides,
	}) as UserQuota;

// Simulates what comes back from Redis: bigint fields serialised as strings.
const makeCachedQuota = (overrides: Partial<UserQuota> = {}) => {
	const q = makeQuota(overrides);
	return {
		id: q.id,
		userId: q.userId,
		storageUsed: q.storageUsed.toString(),
		storageLimit: q.storageLimit.toString(),
		filesCount: q.filesCount,
		filesLimit: q.filesLimit,
		dailyUploads: q.dailyUploads,
		dailyUploadLimit: q.dailyUploadLimit,
		quotaDate: q.quotaDate,
	};
};

const mockQuotaRepo = {
	findOne: jest.fn(),
	createQueryBuilder: jest.fn(),
};

const mockCache = {
	get: jest.fn(),
	set: jest.fn(),
	del: jest.fn(),
};

// mockDataSource.transaction is used by recordUpload, recordDelete, and
// getOrCreateQuota. mockDataSource.query is used by resetDailyUploads.
const mockDataSource = {
	transaction: jest.fn(),
	query: jest.fn(),
};

const mockRedisClient = {
	set: jest.fn(),
	publish: jest.fn(),
};

describe('QuotaService', () => {
	let service: QuotaService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				QuotaService,
				{ provide: CACHE_MANAGER, useValue: mockCache },
				{ provide: DataSource, useValue: mockDataSource },
				{ provide: REDIS_CLIENT, useValue: mockRedisClient },
			],
		}).compile();

		service = module.get(QuotaService);
	});

	// Helper: wire mockDataSource.transaction to use a fake manager that delegates
	// getRepository() to mockQuotaRepo and createQueryBuilder() to a given qb.
	function mockTransaction(qb?: object) {
		mockDataSource.transaction.mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
			return cb({
				getRepository: () => mockQuotaRepo,
				createQueryBuilder: () => qb,
			});
		});
	}

	describe('checkQuota()', () => {
		it('returns allowed=true when quota is within limits', async () => {
			mockCache.get.mockResolvedValue(makeCachedQuota({ storageUsed: 100n, storageLimit: 1000n }));

			const result = await service.checkQuota('user-1', 100);

			expect(result.allowed).toBe(true);
		});

		it('returns allowed=false when storage would be exceeded', async () => {
			mockCache.get.mockResolvedValue(makeCachedQuota({ storageUsed: 900n, storageLimit: 1000n }));

			const result = await service.checkQuota('user-1', 200);

			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Storage limit/);
		});

		it('returns allowed=false when files count is at limit', async () => {
			mockCache.get.mockResolvedValue(makeCachedQuota({ filesCount: 1000, filesLimit: 1000 }));

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Files count/);
		});

		it('returns allowed=false when daily upload limit is reached', async () => {
			mockCache.get.mockResolvedValue(makeCachedQuota({ dailyUploads: 100, dailyUploadLimit: 100 }));

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Daily upload/);
		});

		it('throws BadRequestException for negative blobSize', async () => {
			await expect(service.checkQuota('user-1', -1)).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException for NaN blobSize', async () => {
			await expect(service.checkQuota('user-1', NaN)).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException for float blobSize', async () => {
			await expect(service.checkQuota('user-1', 1.5)).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException for blobSize above Number.MAX_SAFE_INTEGER', async () => {
			await expect(service.checkQuota('user-1', Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow(
				BadRequestException
			);
		});

		it('creates quota row on cache miss and DB miss', async () => {
			mockCache.get.mockResolvedValue(null);
			const quota = makeQuota();
			// findOne returns null first (upsert path), then the created row
			mockQuotaRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(quota);

			const qb = {
				insert: jest.fn().mockReturnThis(),
				into: jest.fn().mockReturnThis(),
				values: jest.fn().mockReturnThis(),
				orIgnore: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({}),
			};
			mockTransaction(qb);
			mockCache.set.mockResolvedValue(undefined);

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(true);
			expect(qb.insert).toHaveBeenCalled();
			// cache.set receives a serialised DTO (bigint fields as strings)
			expect(mockCache.set).toHaveBeenCalledWith(
				'quota:user:user-1',
				expect.objectContaining({
					storageUsed: '0',
					storageLimit: String(DEFAULT_STORAGE_LIMIT_BYTES),
				}),
				expect.any(Number)
			);
		});

		it('throws when quota cannot be created or fetched', async () => {
			mockCache.get.mockResolvedValue(null);
			mockQuotaRepo.findOne.mockResolvedValue(null);

			const qb = {
				insert: jest.fn().mockReturnThis(),
				into: jest.fn().mockReturnThis(),
				values: jest.fn().mockReturnThis(),
				orIgnore: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({}),
			};
			mockTransaction(qb);

			await expect(service.checkQuota('user-1', 1)).rejects.toThrow('Failed to create or fetch quota');
		});

		it('falls back to DB when cache.get throws (Redis outage)', async () => {
			mockCache.get.mockRejectedValue(new Error('Redis connection refused'));
			const quota = makeQuota();
			mockQuotaRepo.findOne.mockResolvedValueOnce(quota);
			mockTransaction();
			mockCache.set.mockResolvedValue(undefined);

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(true);
		});

		it('still returns quota when cache.set throws (Redis outage)', async () => {
			mockCache.get.mockResolvedValue(null);
			const quota = makeQuota();
			mockQuotaRepo.findOne.mockResolvedValueOnce(quota);
			mockTransaction();
			mockCache.set.mockRejectedValue(new Error('Redis connection refused'));

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(true);
		});
	});

	describe('enforceQuota()', () => {
		it('does not throw when quota allows the upload', async () => {
			mockCache.get.mockResolvedValue(makeCachedQuota());
			await expect(service.enforceQuota('user-1', 100)).resolves.toBeUndefined();
		});

		it('throws PayloadTooLargeException (413) when quota is exceeded', async () => {
			mockCache.get.mockResolvedValue(
				makeCachedQuota({ storageUsed: BigInt(DEFAULT_STORAGE_LIMIT_BYTES) })
			);
			await expect(service.enforceQuota('user-1', 1)).rejects.toThrow(PayloadTooLargeException);
		});
	});

	describe('recordUpload()', () => {
		// Helper: set up the transaction mock for a successful quota increment
		function mockUploadTransaction() {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				setParameter: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 1 }),
			};
			mockDataSource.transaction.mockImplementation(async (cb: (m: typeof qb) => Promise<void>) => {
				await cb({ createQueryBuilder: () => qb } as unknown as typeof qb);
			});
			return qb;
		}

		it('executes atomic increment and invalidates cache', async () => {
			const qb = mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			// checkAndPublishQuotaAlert reads quota from cache — below threshold, no alert
			mockCache.get.mockResolvedValue(makeCachedQuota({ storageUsed: 100n }));

			await service.recordUpload('user-1', 512);

			expect(qb.set).toHaveBeenCalledWith(
				expect.objectContaining({
					storageUsed: expect.any(Function),
					filesCount: expect.any(Function),
					dailyUploads: expect.any(Function),
				})
			);
			expect(mockCache.del).toHaveBeenCalledWith('quota:user:user-1');
		});

		it('throws when no quota row exists for the user', async () => {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 0 }),
			};
			mockDataSource.transaction.mockImplementation(async (cb: (m: typeof qb) => Promise<void>) => {
				await cb({ createQueryBuilder: () => qb } as unknown as typeof qb);
			});

			await expect(service.recordUpload('user-1', 512)).rejects.toThrow(
				new Error('No quota row found for user user-1')
			);
		});

		it('throws BadRequestException for invalid blobSize', async () => {
			await expect(service.recordUpload('user-1', -1)).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException for blobSize above Number.MAX_SAFE_INTEGER', async () => {
			await expect(service.recordUpload('user-1', Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow(
				BadRequestException
			);
		});

		it('still resolves when cache.del throws after DB commit (Redis outage)', async () => {
			mockUploadTransaction();
			mockCache.del.mockRejectedValue(new Error('Redis connection refused'));
			// fire-and-forget quota alert will also fail silently
			mockCache.get.mockRejectedValue(new Error('Redis connection refused'));

			await expect(service.recordUpload('user-1', 512)).resolves.toBeUndefined();
		});
	});

	describe('quota.alert events (WHISPR-371)', () => {
		// Helper: wire a successful upload transaction
		function mockUploadTransaction() {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				setParameter: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 1 }),
			};
			mockDataSource.transaction.mockImplementation(async (cb: (m: typeof qb) => Promise<void>) => {
				await cb({ createQueryBuilder: () => qb } as unknown as typeof qb);
			});
			return qb;
		}

		it('publishes quota.alert at 80% threshold when cooldown is not set', async () => {
			mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			// 80% usage: 859000000 / 1073741824 * 100 = 80 (integer division)
			mockCache.get.mockResolvedValue(
				makeCachedQuota({ storageUsed: 859000000n, storageLimit: 1073741824n })
			);
			// SET NX returns 'OK' → cooldown not active → publish
			mockRedisClient.set.mockResolvedValue('OK');
			mockRedisClient.publish.mockResolvedValue(1);

			await service.recordUpload('user-1', 0);

			// Flush microtask queue to resolve fire-and-forget chain
			// Flush microtask queue to allow fire-and-forget chain to complete
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(mockRedisClient.publish).toHaveBeenCalledWith(
				'quota.alert',
				expect.stringContaining('"percent":80')
			);
		});

		it('publishes quota.alert at both 80% and 95% thresholds when at 96%', async () => {
			mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			// 96% usage: 1032000000 / 1073741824 * 100 = 96 (integer division)
			mockCache.get.mockResolvedValue(
				makeCachedQuota({ storageUsed: 1032000000n, storageLimit: 1073741824n })
			);
			mockRedisClient.set.mockResolvedValue('OK');
			mockRedisClient.publish.mockResolvedValue(1);

			await service.recordUpload('user-1', 0);

			// Flush microtask queue to allow fire-and-forget chain to complete
			// Use many flushes: two thresholds each require several awaited calls
			for (let i = 0; i < 20; i++) {
				await Promise.resolve(); // eslint-disable-line no-await-in-loop
			}

			// Both 80% and 95% thresholds triggered
			const calls = mockRedisClient.publish.mock.calls.map((c: string[]) => c[1] as string);
			expect(calls.some((p) => p.includes('"percent":80'))).toBe(true);
			expect(calls.some((p) => p.includes('"percent":95'))).toBe(true);
		});

		it('does not publish quota.alert when cooldown key is already set', async () => {
			mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			// 80% usage
			mockCache.get.mockResolvedValue(
				makeCachedQuota({ storageUsed: 859000000n, storageLimit: 1073741824n })
			);
			// SET NX returns null → cooldown active → no publish
			mockRedisClient.set.mockResolvedValue(null);

			await service.recordUpload('user-1', 0);

			// Flush microtask queue to allow fire-and-forget chain to complete
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(mockRedisClient.publish).not.toHaveBeenCalled();
		});

		it('does not publish quota.alert when usage is below 80%', async () => {
			mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			// 50% usage: 536870912 / 1073741824 * 100 = 50
			mockCache.get.mockResolvedValue(
				makeCachedQuota({ storageUsed: 536870912n, storageLimit: 1073741824n })
			);

			await service.recordUpload('user-1', 0);

			// Flush microtask queue to allow fire-and-forget chain to complete
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(mockRedisClient.publish).not.toHaveBeenCalled();
		});

		it('does not publish quota.alert when storageLimit is zero', async () => {
			mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			mockCache.get.mockResolvedValue(makeCachedQuota({ storageUsed: 0n, storageLimit: 0n }));

			await service.recordUpload('user-1', 0);

			// Flush microtask queue to allow fire-and-forget chain to complete
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			expect(mockRedisClient.publish).not.toHaveBeenCalled();
		});

		it('payload includes userId, storageUsed, storageLimit, percent', async () => {
			mockUploadTransaction();
			mockCache.del.mockResolvedValue(undefined);
			// 80% usage
			mockCache.get.mockResolvedValue(
				makeCachedQuota({ storageUsed: 859000000n, storageLimit: 1073741824n })
			);
			mockRedisClient.set.mockResolvedValue('OK');
			mockRedisClient.publish.mockResolvedValue(1);

			await service.recordUpload('user-1', 0);

			// Flush microtask queue to allow fire-and-forget chain to complete
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			const call = mockRedisClient.publish.mock.calls[0] as [string, string];
			expect(call[0]).toBe('quota.alert');
			const payload = JSON.parse(call[1]) as {
				userId: string;
				storageUsed: string;
				storageLimit: string;
				percent: number;
			};
			expect(payload.userId).toBe('user-1');
			expect(typeof payload.storageUsed).toBe('string');
			expect(typeof payload.storageLimit).toBe('string');
			expect(typeof payload.percent).toBe('number');
		});
	});

	describe('recordDelete()', () => {
		it('executes atomic decrement and invalidates cache', async () => {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				setParameter: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 1 }),
			};
			mockDataSource.transaction.mockImplementation(async (cb: (m: typeof qb) => Promise<void>) => {
				await cb({ createQueryBuilder: () => qb } as unknown as typeof qb);
			});
			mockCache.del.mockResolvedValue(undefined);

			await service.recordDelete('user-1', 512);

			expect(qb.set).toHaveBeenCalledWith(
				expect.objectContaining({
					storageUsed: expect.any(Function),
					filesCount: expect.any(Function),
				})
			);
			expect(mockCache.del).toHaveBeenCalledWith('quota:user:user-1');
		});

		it('throws when no quota row exists for the user', async () => {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 0 }),
			};
			mockDataSource.transaction.mockImplementation(async (cb: (m: typeof qb) => Promise<void>) => {
				await cb({ createQueryBuilder: () => qb } as unknown as typeof qb);
			});

			await expect(service.recordDelete('user-1', 512)).rejects.toThrow(
				new Error('No quota row found for user user-1')
			);
		});

		it('throws BadRequestException for invalid blobSize', async () => {
			await expect(service.recordDelete('user-1', -1)).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException for blobSize above Number.MAX_SAFE_INTEGER', async () => {
			await expect(service.recordDelete('user-1', Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('resetDailyUploads()', () => {
		it('calls the SECURITY DEFINER function and invalidates affected caches', async () => {
			mockDataSource.query.mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]);
			mockCache.del.mockResolvedValue(undefined);

			await service.resetDailyUploads();

			expect(mockDataSource.query).toHaveBeenCalledWith(
				expect.stringContaining('reset_daily_uploads()')
			);
			expect(mockCache.del).toHaveBeenCalledWith('quota:user:u1');
			expect(mockCache.del).toHaveBeenCalledWith('quota:user:u2');
		});

		it('does not call cache.del when no rows are updated', async () => {
			mockDataSource.query.mockResolvedValue([]);
			mockCache.del.mockResolvedValue(undefined);

			await service.resetDailyUploads();

			expect(mockCache.del).not.toHaveBeenCalled();
		});
	});
});

import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { UserQuota } from './entities/user-quota.entity';

const makeQuota = (overrides: Partial<UserQuota> = {}): UserQuota =>
	({
		id: 'quota-id-1',
		userId: 'user-1',
		storageUsed: 0n,
		storageLimit: 1073741824n,
		filesCount: 0,
		filesLimit: 1000,
		dailyUploads: 0,
		dailyUploadLimit: 100,
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

describe('QuotaService', () => {
	let service: QuotaService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				QuotaService,
				{ provide: CACHE_MANAGER, useValue: mockCache },
				{ provide: DataSource, useValue: mockDataSource },
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
				expect.objectContaining({ storageUsed: '0', storageLimit: '1073741824' }),
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
			mockCache.get.mockResolvedValue(makeCachedQuota({ storageUsed: 1073741824n }));
			await expect(service.enforceQuota('user-1', 1)).rejects.toThrow(PayloadTooLargeException);
		});
	});

	describe('recordUpload()', () => {
		it('executes atomic increment and invalidates cache', async () => {
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
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 1 }),
			};
			mockDataSource.transaction.mockImplementation(async (cb: (m: typeof qb) => Promise<void>) => {
				await cb({ createQueryBuilder: () => qb } as unknown as typeof qb);
			});
			mockCache.del.mockRejectedValue(new Error('Redis connection refused'));

			await expect(service.recordUpload('user-1', 512)).resolves.toBeUndefined();
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

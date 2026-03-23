import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { PayloadTooLargeException } from '@nestjs/common';
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

const mockQuotaRepo = {
	findOne: jest.fn(),
	createQueryBuilder: jest.fn(),
};

const mockCache = {
	get: jest.fn(),
	set: jest.fn(),
	del: jest.fn(),
};

const mockDataSource = {
	transaction: jest.fn(),
};

describe('QuotaService', () => {
	let service: QuotaService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				QuotaService,
				{ provide: getRepositoryToken(UserQuota), useValue: mockQuotaRepo },
				{ provide: CACHE_MANAGER, useValue: mockCache },
				{ provide: DataSource, useValue: mockDataSource },
			],
		}).compile();

		service = module.get(QuotaService);
	});

	describe('checkQuota()', () => {
		it('returns allowed=true when quota is within limits', async () => {
			const quota = makeQuota({ storageUsed: 100n, storageLimit: 1000n });
			mockCache.get.mockResolvedValue(quota);

			const result = await service.checkQuota('user-1', 100);

			expect(result.allowed).toBe(true);
		});

		it('returns allowed=false when storage would be exceeded', async () => {
			const quota = makeQuota({ storageUsed: 900n, storageLimit: 1000n });
			mockCache.get.mockResolvedValue(quota);

			const result = await service.checkQuota('user-1', 200);

			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Storage limit/);
		});

		it('returns allowed=false when files count is at limit', async () => {
			const quota = makeQuota({ filesCount: 1000, filesLimit: 1000 });
			mockCache.get.mockResolvedValue(quota);

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Files count/);
		});

		it('returns allowed=false when daily upload limit is reached', async () => {
			const quota = makeQuota({ dailyUploads: 100, dailyUploadLimit: 100 });
			mockCache.get.mockResolvedValue(quota);

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(false);
			expect(result.reason).toMatch(/Daily upload/);
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
			mockQuotaRepo.createQueryBuilder.mockReturnValue(qb);
			mockCache.set.mockResolvedValue(undefined);

			const result = await service.checkQuota('user-1', 1);

			expect(result.allowed).toBe(true);
			expect(qb.insert).toHaveBeenCalled();
			expect(mockCache.set).toHaveBeenCalledWith('quota:user:user-1', quota, expect.any(Number));
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
			mockQuotaRepo.createQueryBuilder.mockReturnValue(qb);

			await expect(service.checkQuota('user-1', 1)).rejects.toThrow('Failed to create or fetch quota');
		});
	});

	describe('enforceQuota()', () => {
		it('does not throw when quota allows the upload', async () => {
			mockCache.get.mockResolvedValue(makeQuota());
			await expect(service.enforceQuota('user-1', 100)).resolves.toBeUndefined();
		});

		it('throws PayloadTooLargeException (413) when quota is exceeded', async () => {
			mockCache.get.mockResolvedValue(makeQuota({ storageUsed: 1073741824n }));
			await expect(service.enforceQuota('user-1', 1)).rejects.toThrow(PayloadTooLargeException);
		});
	});

	describe('recordUpload()', () => {
		it('executes atomic increment and invalidates cache', async () => {
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
	});

	describe('recordDelete()', () => {
		it('executes atomic decrement and invalidates cache', async () => {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				setParameters: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({}),
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
	});

	describe('resetDailyUploads()', () => {
		it('resets daily_uploads for stale rows and invalidates their caches', async () => {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				returning: jest.fn().mockReturnThis(),
				execute: jest
					.fn()
					.mockResolvedValue({ affected: 2, raw: [{ user_id: 'u1' }, { user_id: 'u2' }] }),
			};
			mockQuotaRepo.createQueryBuilder.mockReturnValue(qb);
			mockCache.del.mockResolvedValue(undefined);

			await service.resetDailyUploads();

			expect(qb.set).toHaveBeenCalledWith(
				expect.objectContaining({ dailyUploads: 0, quotaDate: expect.any(Function) })
			);
			expect(mockCache.del).toHaveBeenCalledWith('quota:user:u1');
			expect(mockCache.del).toHaveBeenCalledWith('quota:user:u2');
		});

		it('uses raw rows (not affected) for cache invalidation when affected is null', async () => {
			const qb = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				returning: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: null, raw: [{ user_id: 'u3' }] }),
			};
			mockQuotaRepo.createQueryBuilder.mockReturnValue(qb);
			mockCache.del.mockResolvedValue(undefined);

			await service.resetDailyUploads();

			expect(mockCache.del).toHaveBeenCalledWith('quota:user:u3');
			expect(mockCache.del).toHaveBeenCalledTimes(1);
		});
	});
});

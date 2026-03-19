import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';
import { getS3ConnectionToken } from 'nestjs-s3';

describe('HealthController', () => {
	let controller: HealthController;

	const mockDataSource = {
		query: jest.fn(),
	};

	const mockCacheManager = {
		set: jest.fn(),
		get: jest.fn(),
	};

	const mockS3 = {
		listBuckets: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [HealthController],
			providers: [
				{ provide: DataSource, useValue: mockDataSource },
				{ provide: CACHE_MANAGER, useValue: mockCacheManager },
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
			],
		}).compile();

		controller = module.get<HealthController>(HealthController);

		jest.clearAllMocks();
	});

	describe('readiness()', () => {
		it('should return { status: "ready" } with HTTP 200 when all dependencies are healthy', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });

			const result = await controller.readiness();

			expect(result).toEqual({ status: 'ready' });
		});

		it('should throw HttpException with HTTP 503 when database is unreachable', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheManager.set.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready', error: 'Connection refused' },
			});
		});

		it('should throw HttpException with HTTP 503 when cache is unreachable', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockRejectedValue(new Error('Redis unavailable'));
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready' },
			});
		});

		it('should throw HttpException with HTTP 503 when S3/MinIO is unreachable', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockS3.listBuckets.mockRejectedValue(new Error('MinIO unreachable'));

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready' },
			});
		});
	});

	describe('alive()', () => {
		it('should return alive status with HTTP 200', () => {
			const result = controller.alive();

			expect(result.status).toBe('alive');
			expect(result.timestamp).toBeDefined();
			expect(result.uptime).toBeDefined();
		});
	});
});

import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';
import { getS3ConnectionToken } from 'nestjs-s3';
import { JwksService } from '../jwks/jwks.service';

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

	const mockJwksService = {
		isReady: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [HealthController],
			providers: [
				{ provide: DataSource, useValue: mockDataSource },
				{ provide: CACHE_MANAGER, useValue: mockCacheManager },
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: JwksService, useValue: mockJwksService },
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
			mockJwksService.isReady.mockReturnValue(true);

			const result = await controller.readiness();

			expect(result).toEqual({ status: 'ready' });
		});

		it('should throw HttpException with HTTP 503 when database is unreachable', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheManager.set.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(true);

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready', error: 'Connection refused' },
			});
		});

		it('should throw HttpException with HTTP 503 when cache is unreachable', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockRejectedValue(new Error('Redis unavailable'));
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(true);

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready' },
			});
		});

		it('should throw HttpException with HTTP 503 when S3/MinIO is unreachable', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockS3.listBuckets.mockRejectedValue(new Error('MinIO unreachable'));
			mockJwksService.isReady.mockReturnValue(true);

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready' },
			});
		});

		it('should throw HttpException with HTTP 503 when JWKS key is not loaded', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(false);

			await expect(controller.readiness()).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: { status: 'not ready', error: 'ES256 public key not loaded' },
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

	describe('check()', () => {
		it('should return status ok with all services healthy when all dependencies succeed', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(true);

			const result = await controller.check();

			expect(result.status).toBe('ok');
			expect(result.services).toEqual({
				database: 'healthy',
				cache: 'healthy',
				minio: 'healthy',
				jwks: 'healthy',
			});
		});

		it('should return status error with database unhealthy when database fails', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(true);

			const result = await controller.check();

			expect(result.status).toBe('error');
			expect(result.services).toEqual({
				database: 'unhealthy',
				cache: 'healthy',
				minio: 'healthy',
				jwks: 'healthy',
			});
		});

		it('should return status error with cache unhealthy when cache fails', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockRejectedValue(new Error('Redis unavailable'));
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(true);

			const result = await controller.check();

			expect(result.status).toBe('error');
			expect(result.services).toEqual({
				database: 'healthy',
				cache: 'unhealthy',
				minio: 'healthy',
				jwks: 'healthy',
			});
		});

		it('should return status error with minio unhealthy when S3 fails', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockRejectedValue(new Error('MinIO unreachable'));
			mockJwksService.isReady.mockReturnValue(true);

			const result = await controller.check();

			expect(result.status).toBe('error');
			expect(result.services).toEqual({
				database: 'healthy',
				cache: 'healthy',
				minio: 'unhealthy',
				jwks: 'healthy',
			});
		});

		it('should return status error with jwks unhealthy when JWKS key is not loaded', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(false);

			const result = await controller.check();

			expect(result.status).toBe('error');
			expect(result.services).toEqual({
				database: 'healthy',
				cache: 'healthy',
				minio: 'healthy',
				jwks: 'unhealthy',
			});
		});

		it('should return status error with all services unhealthy when all dependencies fail', async () => {
			mockDataSource.query.mockRejectedValue(new Error('DB down'));
			mockCacheManager.set.mockRejectedValue(new Error('Cache down'));
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockRejectedValue(new Error('S3 down'));
			mockJwksService.isReady.mockReturnValue(false);

			const result = await controller.check();

			expect(result.status).toBe('error');
			expect(result.services).toEqual({
				database: 'unhealthy',
				cache: 'unhealthy',
				minio: 'unhealthy',
				jwks: 'unhealthy',
			});
		});

		it('should always include timestamp, uptime, memory, and version in the response', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheManager.set.mockResolvedValue(undefined);
			mockCacheManager.get.mockResolvedValue(undefined);
			mockS3.listBuckets.mockResolvedValue({ Buckets: [] });
			mockJwksService.isReady.mockReturnValue(true);

			const result = await controller.check();

			expect(result.timestamp).toBeDefined();
			expect(result.uptime).toBeDefined();
			expect(result.memory).toBeDefined();
			expect(result.version).toBeDefined();
		});
	});
});

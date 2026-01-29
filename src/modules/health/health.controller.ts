import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectS3, S3 } from 'nestjs-s3';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	private logger = new Logger(HealthController.name);
	constructor(
		private readonly dataSource: DataSource,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
		@InjectS3() private readonly s3: S3
	) {}

	@Get()
	@ApiOperation({
		summary: 'Check service health',
		description: 'Returns the health status of the service and its dependencies (database and cache)',
	})
	@ApiResponse({ status: 200, description: 'Health check completed successfully' })
	@ApiResponse({ status: 500, description: 'One or more services are unhealthy' })
	async check() {
		this.logger.debug('Health check started');

		const health = {
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			version: process.env.npm_package_version || '1.0.0',
			services: {
				database: 'unknown',
				cache: 'unknown',
				minio: 'unknown',
			},
		};

		// Check database connection
		try {
			this.logger.debug('Checking database connection');
			await this.dataSource.query('SELECT 1');
			health.services.database = 'healthy';
			this.logger.debug('Database check passed');
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Database check failed:', error.message);
			}
			health.services.database = 'unhealthy';
			health.status = 'error';
		}

		// Check cache connection
		try {
			this.logger.debug('Checking cache connection');
			await this.cacheManager.set('health-check', 'ok', 1000);
			await this.cacheManager.get('health-check');
			health.services.cache = 'healthy';
			this.logger.debug('Cache check passed');
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Cache check failed:', error.message);
			}
			health.services.cache = 'unhealthy';
			health.status = 'error';
		}

		// Check Minio (S3) connection
		try {
			this.logger.debug('Checking Minio (S3) connection');
			await this.s3.listBuckets();
			health.services.minio = 'healthy';
			this.logger.debug('Minio (S3) check passed');
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Minio (S3) check failed:', error.message);
			}
			health.services.minio = 'unhealthy';
			health.status = 'error';
		}

		this.logger.debug('Health check completed:', health);
		return health;
	}

	@Get('ready')
	@ApiOperation({
		summary: 'Check service readiness',
		description: 'Returns whether the service is ready to accept traffic',
	})
	@ApiResponse({ status: 200, description: 'Service is ready' })
	@ApiResponse({ status: 503, description: 'Service is not ready' })
	async readiness() {
		try {
			await this.dataSource.query('SELECT 1');
			await this.cacheManager.set('readiness-check', 'ok', 1000);
			await this.s3.listBuckets();
			return { status: 'ready' };
		} catch (error) {
			return { status: 'not ready', error: error.message };
		}
	}

	@Get('live')
	@ApiOperation({
		summary: 'Check service liveness',
		description: 'Returns whether the service is alive and responding',
	})
	@ApiResponse({ status: 200, description: 'Service is alive' })
	alive() {
		return {
			status: 'alive',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			version: process.env.npm_package_version || '1.0.0',
		};
	}
}

import { Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { S3Module } from 'nestjs-s3';
import { ThrottlerModule, ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { envValidationSchema } from './config/env-validation.schema';
import { cacheModuleAsyncOptions } from './config/cache.config';
import { typeOrmModuleAsyncOptions } from './config/typeorm.config';
import { s3ModuleAsyncOptions } from './config/s3.config';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { JwksModule } from './modules/jwks/jwks.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { MetricsModule } from './modules/metrics/metrics.module';

// WHISPR-1012: Rate limiting (align with the other NestJS services:
// auth-service, user-service, scheduling-service).
// https://docs.nestjs.com/security/rate-limiting#multiple-throttler-definitions
const SHORT_THROTTLER: ThrottlerOptions = { name: 'short', ttl: 1000, limit: 3 };
const MEDIUM_THROTTLER: ThrottlerOptions = { name: 'medium', ttl: 10000, limit: 20 };
const LONG_THROTTLER: ThrottlerOptions = { name: 'long', ttl: 60000, limit: 100 };

const throttlerGuardProvider: Provider = {
	provide: APP_GUARD,
	useClass: ThrottlerGuard,
};

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ['.env.development', '.env.local', '.env'],
			validationSchema: envValidationSchema,
			validationOptions: { abortEarly: false },
		}),
		TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
		CacheModule.registerAsync(cacheModuleAsyncOptions),
		ScheduleModule.forRoot(),
		S3Module.forRootAsync(s3ModuleAsyncOptions),
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				throttlers: [SHORT_THROTTLER, MEDIUM_THROTTLER, LONG_THROTTLER],
				storage: new ThrottlerStorageRedisService(
					new Redis({
						host: configService.get<string>('REDIS_HOST', 'redis'),
						port: Number(configService.get<string>('REDIS_PORT', '6379')),
						username: configService.get<string>('REDIS_USERNAME') || undefined,
						password: configService.get<string>('REDIS_PASSWORD') || undefined,
						lazyConnect: false,
					})
				),
			}),
		}),
		JwksModule,
		AuthModule,
		HealthModule,
		MediaModule,
		EventsModule,
		MetricsModule,
	],
	providers: [throttlerGuardProvider],
})
export class AppModule {}

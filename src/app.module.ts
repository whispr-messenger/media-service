import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { S3Module } from 'nestjs-s3';
import { envValidationSchema } from './config/env-validation.schema';
import { cacheModuleAsyncOptions } from './config/cache.config';
import { typeOrmModuleAsyncOptions } from './config/typeorm.config';
import { s3ModuleAsyncOptions } from './config/s3.config';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { JwksModule } from './modules/jwks/jwks.module';

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
		JwksModule,
		HealthModule,
		MediaModule,
	],
})
export class AppModule {}

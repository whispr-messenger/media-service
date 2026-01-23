import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { cacheModuleAsyncOptions } from './config/cache.config';
import { typeOrmModuleAsyncOptions } from './config/typeorm.config';
import { HealthModule } from './modules/health/health.module';


@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ['.env.development', '.env.local', '.env'],
		}),
		TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
		CacheModule.registerAsync(cacheModuleAsyncOptions),
		HealthModule,
	],
})
export class AppModule {}
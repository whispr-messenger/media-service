import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR, ModuleRef } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createClient } from '@redis/client';
import { Media } from './entities/media.entity';
import { UserQuota } from './entities/user-quota.entity';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaAccessLogPartitionService } from './media-access-log-partition.service';
import { StorageService } from './storage.service';
import { QuotaService } from './quota.service';
import { LifecycleService } from './lifecycle.service';
import { RlsContextService } from './rls-context.service';
import { RlsInterceptor } from './rls.interceptor';
import { RlsSubscriber } from './rls.subscriber';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
	imports: [TypeOrmModule.forFeature([Media, UserQuota, MediaAccessLog]), ConfigModule],
	providers: [
		{
			provide: REDIS_CLIENT,
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => {
				const host = configService.get('REDIS_HOST', 'redis');
				const port = configService.get('REDIS_PORT', 6379);
				const client = createClient({ socket: { host, port } });
				await client.connect();
				return client;
			},
		},
		MediaRepository,
		StorageService,
		MediaService,
		MediaAccessLogPartitionService,
		QuotaService,
		LifecycleService,
		RlsContextService,
		RlsSubscriber,
		// Global interceptor — applies to all routes including unauthenticated ones.
		// This is intentional: the interceptor is a no-op when userId is absent,
		// and registering it globally avoids forgetting to apply it on new routes.
		{
			provide: APP_INTERCEPTOR,
			useClass: RlsInterceptor,
		},
	],
	controllers: [MediaController],
	exports: [QuotaService],
})
export class MediaModule implements OnModuleDestroy {
	constructor(private readonly moduleRef: ModuleRef) {}

	async onModuleDestroy(): Promise<void> {
		const client = this.moduleRef.get<ReturnType<typeof createClient>>(REDIS_CLIENT, {
			strict: false,
		});
		await client?.quit();
	}
}

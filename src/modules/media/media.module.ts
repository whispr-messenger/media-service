import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { UserQuota } from './entities/user-quota.entity';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaAccessLogPartitionService } from './media-access-log-partition.service';
import { StorageService } from './storage.service';
import { RlsContextService } from './rls-context.service';
import { RlsInterceptor } from './rls.interceptor';
import { RlsSubscriber } from './rls.subscriber';

@Module({
	imports: [TypeOrmModule.forFeature([Media, UserQuota, MediaAccessLog])],
	providers: [
		MediaRepository,
		StorageService,
		MediaService,
		MediaAccessLogPartitionService,
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
})
export class MediaModule {}

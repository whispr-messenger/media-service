import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { UserQuota } from './entities/user-quota.entity';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { MediaAccessLogPartitionService } from './media-access-log-partition.service';
import { StorageService } from './storage.service';

@Module({
	imports: [TypeOrmModule.forFeature([Media, UserQuota, MediaAccessLog])],
	providers: [MediaRepository, StorageService, MediaService, MediaAccessLogPartitionService],
	controllers: [MediaController],
})
export class MediaModule {}

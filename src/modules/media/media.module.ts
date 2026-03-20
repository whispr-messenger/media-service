import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { UserQuota } from './entities/user-quota.entity';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Media, UserQuota])],
	providers: [MediaRepository, MediaService],
	controllers: [MediaController],
})
export class MediaModule {}

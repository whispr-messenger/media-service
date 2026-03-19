import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaFile } from './entities/media-file.entity';
import { MediaFileRepository } from './repositories/media-file.repository';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
	imports: [TypeOrmModule.forFeature([MediaFile])],
	providers: [MediaFileRepository, MediaService],
	controllers: [MediaController],
})
export class MediaModule {}

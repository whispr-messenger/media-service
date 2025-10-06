import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { EncryptionModule } from '../encryption/encryption.module';
import { StorageModule } from '../storage/storage.module';
import { GrpcModule } from '../grpc/grpc.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    DatabaseModule,
    EncryptionModule,
    StorageModule,
    GrpcModule,
    AuthModule,
    CacheModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

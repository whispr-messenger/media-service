import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthClient } from './auth.client';
import { ModerationClient } from './moderation.client';

@Module({
  imports: [ConfigModule],
  providers: [AuthClient, ModerationClient],
  exports: [AuthClient, ModerationClient],
})
export class GrpcModule {}

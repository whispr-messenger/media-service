import { Module } from '@nestjs/common';
import { GrpcModule } from '../grpc/grpc.module';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';

@Module({
  imports: [GrpcModule],
  providers: [AuthGuard, PermissionGuard],
  exports: [AuthGuard, PermissionGuard],
})
export class AuthModule {}

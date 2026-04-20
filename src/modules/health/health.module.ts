import { Module } from '@nestjs/common';
import { JwksModule } from '../jwks/jwks.module';
import { HealthController } from './health.controller';

@Module({
	imports: [JwksModule],
	controllers: [HealthController],
})
export class HealthModule {}

import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsGuard } from './metrics.guard';

@Global()
@Module({
	providers: [MetricsService, MetricsGuard],
	controllers: [MetricsController],
	exports: [MetricsService],
})
export class MetricsModule {}

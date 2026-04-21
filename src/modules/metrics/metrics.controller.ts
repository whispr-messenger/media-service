import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { MetricsService } from './metrics.service';
import { MetricsGuard } from './metrics.guard';

// Prometheus scrape endpoint — already protected by MetricsGuard,
// not subject to user-facing rate limiting (WHISPR-1012).
@SkipThrottle()
@Public()
@UseGuards(MetricsGuard)
@ApiTags('Metrics')
@Controller()
export class MetricsController {
	constructor(private readonly metricsService: MetricsService) {}

	@Get('metrics')
	@ApiOperation({ summary: 'Prometheus metrics endpoint' })
	@ApiResponse({ status: 200, description: 'Prometheus metrics' })
	async getMetrics(@Res() res: Response): Promise<void> {
		const metrics = await this.metricsService.getMetrics();
		res.setHeader('Content-Type', this.metricsService.getContentType());
		res.send(metrics);
	}
}

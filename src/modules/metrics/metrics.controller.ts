import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiProduces, ApiSecurity } from '@nestjs/swagger';
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
@ApiSecurity('metrics-key')
@Controller()
export class MetricsController {
	constructor(private readonly metricsService: MetricsService) {}

	@Get('metrics')
	@ApiOperation({ summary: 'Prometheus metrics endpoint' })
	@ApiHeader({
		name: 'x-metrics-key',
		required: false,
		description: 'API key for metrics access (required in production)',
	})
	@ApiProduces('text/plain')
	@ApiResponse({ status: 200, description: 'Prometheus metrics in text/plain format' })
	@ApiResponse({ status: 403, description: 'Invalid or missing metrics API key' })
	async getMetrics(@Res() res: Response): Promise<void> {
		const metrics = await this.metricsService.getMetrics();
		res.setHeader('Content-Type', this.metricsService.getContentType());
		res.send(metrics);
	}
}

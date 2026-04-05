import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class MetricsGuard implements CanActivate {
	constructor(private readonly configService: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const apiKey = this.configService.get<string>('METRICS_API_KEY');

		if (!apiKey) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const provided = request.headers['x-metrics-key'] as string | undefined;

		return provided === apiKey;
	}
}

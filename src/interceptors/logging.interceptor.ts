import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(LoggingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const { method, url, ip } = request;
		const userAgent = request.get('User-Agent') || '';
		const userId = request.headers['x-user-id'] as string | undefined;
		const startTime = Date.now();

		return next.handle().pipe(
			tap({
				next: () => {
					const duration = Date.now() - startTime;
					const contentLength = response.getHeader('content-length') || 0;
					this.logger.log(
						JSON.stringify({
							method,
							url,
							statusCode: response.statusCode,
							duration,
							userId: userId || null,
							contentLength: Number(contentLength),
							ip,
							userAgent,
						})
					);
				},
				error: (error) => {
					const duration = Date.now() - startTime;
					this.logger.error(
						JSON.stringify({
							method,
							url,
							statusCode: error.status || 500,
							duration,
							userId: userId || null,
							contentLength: 0,
							ip,
							userAgent,
							error: error.message,
						})
					);
				},
			})
		);
	}
}

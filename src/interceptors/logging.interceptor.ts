import { randomUUID } from 'node:crypto';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

// WHISPR-1068 : émet des objets structurés au lieu d'un JSON.stringify
// manuel — JsonLogger les fusionne avec les champs système. Ajoute aussi
// la propagation X-Request-Id (absente jusqu'ici côté media-service).
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(LoggingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const { method, url, ip } = request;
		const userAgent = request.get('User-Agent') || '';
		const userId = (request as any).user?.userId;
		const raw = request.get('X-Request-Id') || '';
		const requestId = /^[a-zA-Z0-9-]{1,64}$/.test(raw) ? raw : randomUUID();
		const startTime = Date.now();

		response.setHeader('X-Request-Id', requestId);

		return next.handle().pipe(
			tap({
				next: () => {
					const duration = Date.now() - startTime;
					const contentLength = response.getHeader('content-length') || 0;
					this.logger.log({
						event: 'http_response',
						request_id: requestId,
						method,
						url,
						status: response.statusCode,
						duration_ms: duration,
						user_id: userId ?? null,
						content_length: Number(contentLength),
						ip,
						user_agent: userAgent,
					});
				},
				error: (error: unknown) => {
					const duration = Date.now() - startTime;
					const status = error instanceof Object && 'status' in error ? (error as any).status : 500;
					const message = error instanceof Error ? error.message : String(error);
					this.logger.error({
						event: 'http_error',
						request_id: requestId,
						method,
						url,
						status,
						duration_ms: duration,
						user_id: userId ?? null,
						ip,
						user_agent: userAgent,
						error_message: message,
					});
				},
			})
		);
	}
}

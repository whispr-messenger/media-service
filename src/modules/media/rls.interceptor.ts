import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { RlsContextService } from './rls-context.service';

/**
 * NestJS interceptor that binds the authenticated user ID (from the JWT,
 * populated by the auth guard) into AsyncLocalStorage per-request state.
 *
 * Because interceptors run **after** guards in the NestJS lifecycle
 * (`Middleware → Guard → Interceptor → Controller`), `request.user` is
 * guaranteed to be set by the {@link JwtAuthGuard} before this code executes.
 *
 * The {@link RlsSubscriber} then picks up the user ID on every transaction
 * start and runs `set_config('app.current_user_id', …)` so PostgreSQL RLS
 * policies can restrict rows to the request owner.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
	constructor(private readonly rlsContext: RlsContextService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<Request>();
		const userId = (request.user as { userId?: string } | undefined)?.userId;

		if (!userId) {
			return next.handle();
		}

		return new Observable((observer) => {
			this.rlsContext.run(userId, () => {
				next.handle().subscribe(observer);
			});
		});
	}
}

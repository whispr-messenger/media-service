import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RlsContextService } from './rls-context.service';

/**
 * NestJS middleware that binds the current user ID (from the `x-user-id`
 * request header) to the request's AsyncLocalStorage context.
 *
 * The {@link RlsSubscriber} then picks it up on every transaction start and
 * runs `SET LOCAL "app.current_user_id" = '...'` so PostgreSQL RLS policies
 * can restrict rows to the request owner.
 */
@Injectable()
export class RlsMiddleware implements NestMiddleware {
	private static readonly UUID_RE =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

	constructor(private readonly rlsContext: RlsContextService) {}

	use(req: Request, res: Response, next: NextFunction): void {
		const userId = req.headers['x-user-id'];

		if (!userId || typeof userId !== 'string' || !RlsMiddleware.UUID_RE.test(userId)) {
			return next();
		}

		this.rlsContext.run(userId, () => next());
	}
}

import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RlsContext {
	userId: string;
}

/**
 * Stores the current-request user ID in an AsyncLocalStorage so that it is
 * available to the TypeORM subscriber on any execution path within the same
 * async call chain.
 */
@Injectable()
export class RlsContextService {
	private readonly storage = new AsyncLocalStorage<RlsContext>();

	/**
	 * Run `fn` with `userId` bound to the current async context.
	 */
	run<T>(userId: string, fn: () => T): T {
		return this.storage.run({ userId }, fn);
	}

	/** Returns the user ID for the current async context, or null. */
	getCurrentUserId(): string | null {
		return this.storage.getStore()?.userId ?? null;
	}
}

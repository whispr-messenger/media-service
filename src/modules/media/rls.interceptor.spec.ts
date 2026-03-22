import { of, firstValueFrom } from 'rxjs';
import { RlsInterceptor } from './rls.interceptor';
import { RlsContextService } from './rls-context.service';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

function makeContext(user?: { userId: string }): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ user }),
		}),
	} as unknown as ExecutionContext;
}

function makeCallHandler(value: unknown): CallHandler {
	return { handle: () => of(value) } as unknown as CallHandler;
}

describe('RlsInterceptor', () => {
	let interceptor: RlsInterceptor;
	let rlsContext: RlsContextService;

	beforeEach(() => {
		rlsContext = new RlsContextService();
		interceptor = new RlsInterceptor(rlsContext);
	});

	it('passes through without binding context when request.user is undefined', async () => {
		const runSpy = jest.spyOn(rlsContext, 'run');
		const ctx = makeContext(undefined);
		const handler = makeCallHandler('ok');

		const result = await firstValueFrom(interceptor.intercept(ctx, handler));

		expect(result).toBe('ok');
		expect(runSpy).not.toHaveBeenCalled();
	});

	it('passes through without binding context when userId is missing from user', async () => {
		const runSpy = jest.spyOn(rlsContext, 'run');
		const ctx = makeContext({} as { userId: string });
		const handler = makeCallHandler('ok');

		const result = await firstValueFrom(interceptor.intercept(ctx, handler));

		expect(result).toBe('ok');
		expect(runSpy).not.toHaveBeenCalled();
	});

	it('binds the userId and forwards the handler result when user is authenticated', async () => {
		const userId = '550e8400-e29b-41d4-a716-446655440000';
		const runSpy = jest.spyOn(rlsContext, 'run');
		const ctx = makeContext({ userId });
		const handler = makeCallHandler({ data: 'test' });

		const result = await firstValueFrom(interceptor.intercept(ctx, handler));

		expect(result).toEqual({ data: 'test' });
		expect(runSpy).toHaveBeenCalledWith(userId, expect.any(Function));
	});

	it('makes the userId available via RlsContextService inside the handler', async () => {
		const userId = '550e8400-e29b-41d4-a716-446655440000';
		const ctx = makeContext({ userId });

		let capturedUserId: string | null = null;
		const originalRun = rlsContext.run.bind(rlsContext);
		jest.spyOn(rlsContext, 'run').mockImplementation(<T>(id: string, fn: () => T): T => {
			return originalRun(id, () => {
				capturedUserId = rlsContext.getCurrentUserId();
				return fn();
			});
		});

		const handler = makeCallHandler('ok');
		await firstValueFrom(interceptor.intercept(ctx, handler));

		expect(capturedUserId).toBe(userId);
	});
});

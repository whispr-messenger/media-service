import { of, firstValueFrom, Observable, Subject } from 'rxjs';
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

	it('unsubscribes from the inner stream when the outer observable is unsubscribed', () => {
		const userId = '550e8400-e29b-41d4-a716-446655440000';
		const ctx = makeContext({ userId });

		let innerUnsubscribed = false;
		const innerObservable = new Observable(() => {
			return () => {
				innerUnsubscribed = true;
			};
		});

		const handler: CallHandler = { handle: () => innerObservable as Observable<unknown> };
		const outer = interceptor.intercept(ctx, handler);
		const subscription = outer.subscribe();

		expect(innerUnsubscribed).toBe(false);
		subscription.unsubscribe();
		expect(innerUnsubscribed).toBe(true);
	});

	it('isolates concurrent requests with different userIds', async () => {
		const userA = 'aaaa-aaaa-aaaa';
		const userB = 'bbbb-bbbb-bbbb';

		const subjectA = new Subject<string>();
		const subjectB = new Subject<string>();

		const ctxA = makeContext({ userId: userA });
		const ctxB = makeContext({ userId: userB });

		let capturedInA: string | null = null;
		let capturedInB: string | null = null;

		const handlerA: CallHandler = {
			handle: () =>
				new Observable<string>((observer) => {
					capturedInA = rlsContext.getCurrentUserId();
					subjectA.subscribe(observer);
				}),
		};

		const handlerB: CallHandler = {
			handle: () =>
				new Observable<string>((observer) => {
					capturedInB = rlsContext.getCurrentUserId();
					subjectB.subscribe(observer);
				}),
		};

		const resultA = firstValueFrom(interceptor.intercept(ctxA, handlerA) as Observable<string>);
		const resultB = firstValueFrom(interceptor.intercept(ctxB, handlerB) as Observable<string>);

		subjectA.next('resultA');
		subjectA.complete();
		subjectB.next('resultB');
		subjectB.complete();

		expect(await resultA).toBe('resultA');
		expect(await resultB).toBe('resultB');
		expect(capturedInA).toBe(userA);
		expect(capturedInB).toBe(userB);
	});
});

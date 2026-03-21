import type { Request, Response, NextFunction } from 'express';
import { RlsMiddleware } from './rls.middleware';
import { RlsContextService } from './rls-context.service';

const makeReq = (userId?: string): Partial<Request> => ({
	headers: userId ? { 'x-user-id': userId } : {},
});

describe('RlsMiddleware', () => {
	let middleware: RlsMiddleware;
	let rlsContext: RlsContextService;

	beforeEach(() => {
		rlsContext = new RlsContextService();
		middleware = new RlsMiddleware(rlsContext);
	});

	it('calls next() without binding context when x-user-id header is missing', () => {
		const next = jest.fn() as NextFunction;
		const runSpy = jest.spyOn(rlsContext, 'run');

		middleware.use(makeReq() as Request, {} as Response, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(runSpy).not.toHaveBeenCalled();
	});

	it('calls next() without binding context when x-user-id is not a valid UUID', () => {
		const next = jest.fn() as NextFunction;
		const runSpy = jest.spyOn(rlsContext, 'run');

		middleware.use(makeReq('not-a-uuid') as Request, {} as Response, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(runSpy).not.toHaveBeenCalled();
	});

	it('binds the userId and calls next() when x-user-id is a valid UUID', () => {
		const userId = '550e8400-e29b-41d4-a716-446655440000';
		const next = jest.fn() as NextFunction;

		let capturedUserId: string | null = null;
		const runSpy = jest.spyOn(rlsContext, 'run').mockImplementation(<T>(id: string, fn: () => T): T => {
			capturedUserId = id;
			return fn();
		});

		middleware.use(makeReq(userId) as Request, {} as Response, next);

		expect(runSpy).toHaveBeenCalledWith(userId, expect.any(Function));
		expect(capturedUserId).toBe(userId);
		expect(next).toHaveBeenCalledTimes(1);
	});
});

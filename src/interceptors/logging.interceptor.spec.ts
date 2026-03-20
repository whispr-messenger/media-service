import { of, throwError, firstValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function makeContext(mockRequest: Record<string, unknown>, mockResponse: Record<string, unknown>) {
	return {
		switchToHttp: () => ({
			getRequest: () => mockRequest,
			getResponse: () => mockResponse,
		}),
	} as any;
}

function makeCallHandler(observable: any) {
	return { handle: () => observable } as any;
}

describe('LoggingInterceptor', () => {
	let interceptor: LoggingInterceptor;
	let mockRequest: Record<string, unknown>;
	let mockResponse: Record<string, unknown>;

	beforeEach(() => {
		interceptor = new LoggingInterceptor();
		mockRequest = {
			method: 'GET',
			url: '/test',
			ip: '127.0.0.1',
			get: jest.fn().mockReturnValue('test-agent'),
		};
		mockResponse = { statusCode: 200 };
		jest.spyOn(interceptor['logger'], 'log').mockImplementation(() => undefined);
		jest.spyOn(interceptor['logger'], 'error').mockImplementation(() => undefined);
	});

	it('returns the value from next.handle() unchanged', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of({ result: 'data' }));

		const result$ = interceptor.intercept(context, callHandler);
		const value = await firstValueFrom(result$);

		expect(value).toEqual({ result: 'data' });
	});

	it('completes successfully on a normal response', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		const result$ = interceptor.intercept(context, callHandler);

		await expect(firstValueFrom(result$)).resolves.toBe('ok');
	});

	it('propagates errors from next.handle()', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const error = new Error('something went wrong');
		const callHandler = makeCallHandler(throwError(() => error));

		const result$ = interceptor.intercept(context, callHandler);

		await expect(firstValueFrom(result$)).rejects.toThrow('something went wrong');
	});
});

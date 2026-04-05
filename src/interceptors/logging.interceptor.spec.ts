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
			headers: {},
			user: { userId: 'user-123' },
		};
		mockResponse = {
			statusCode: 200,
			getHeader: jest.fn().mockReturnValue('1234'),
		};
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

	it('logs structured JSON on success', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		const result$ = interceptor.intercept(context, callHandler);
		await firstValueFrom(result$);

		expect(interceptor['logger'].log).toHaveBeenCalled();
		const logArg = (interceptor['logger'].log as jest.Mock).mock.calls[0][0];
		const parsed = JSON.parse(logArg);
		expect(parsed.method).toBe('GET');
		expect(parsed.url).toBe('/test');
		expect(parsed.statusCode).toBe(200);
		expect(parsed.userId).toBe('user-123');
		expect(typeof parsed.duration).toBe('number');
		expect(parsed.contentLength).toBe(1234);
	});

	it('logs structured JSON on error', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const error = Object.assign(new Error('something went wrong'), { status: 400 });
		const callHandler = makeCallHandler(throwError(() => error));

		const result$ = interceptor.intercept(context, callHandler);

		await expect(firstValueFrom(result$)).rejects.toThrow('something went wrong');

		expect(interceptor['logger'].error).toHaveBeenCalled();
		const logArg = (interceptor['logger'].error as jest.Mock).mock.calls[0][0];
		const parsed = JSON.parse(logArg);
		expect(parsed.statusCode).toBe(400);
		expect(parsed.error).toBe('something went wrong');
	});

	it('handles missing user gracefully', async () => {
		delete (mockRequest as any).user;
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		const result$ = interceptor.intercept(context, callHandler);
		await firstValueFrom(result$);

		const logArg = (interceptor['logger'].log as jest.Mock).mock.calls[0][0];
		const parsed = JSON.parse(logArg);
		expect(parsed.userId).toBeNull();
	});
});

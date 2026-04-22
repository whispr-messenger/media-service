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
			get: jest.fn().mockImplementation((header: string) => {
				if (header === 'User-Agent') return 'test-agent';
				if (header === 'X-Request-Id') return 'req-test-123';
				return undefined;
			}),
			headers: {},
			user: { userId: 'user-123' },
		};
		mockResponse = {
			statusCode: 200,
			getHeader: jest.fn().mockReturnValue('1234'),
			setHeader: jest.fn(),
		};
		jest.spyOn(interceptor['logger'], 'log').mockImplementation(() => undefined);
		jest.spyOn(interceptor['logger'], 'error').mockImplementation(() => undefined);
	});

	it('returns the value from next.handle() unchanged', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of({ result: 'data' }));

		const value = await firstValueFrom(interceptor.intercept(context, callHandler));

		expect(value).toEqual({ result: 'data' });
	});

	it('emits a structured success payload', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		await firstValueFrom(interceptor.intercept(context, callHandler));

		expect(interceptor['logger'].log).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'http_response',
				request_id: 'req-test-123',
				method: 'GET',
				url: '/test',
				status: 200,
				user_id: 'user-123',
				content_length: 1234,
			})
		);
	});

	it('emits a structured error payload', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const error = Object.assign(new Error('something went wrong'), { status: 400 });
		const callHandler = makeCallHandler(throwError(() => error));

		await expect(firstValueFrom(interceptor.intercept(context, callHandler))).rejects.toThrow(
			'something went wrong'
		);

		expect(interceptor['logger'].error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'http_error',
				request_id: 'req-test-123',
				status: 400,
				error_message: 'something went wrong',
			})
		);
	});

	it('handles missing user gracefully', async () => {
		delete (mockRequest as any).user;
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		await firstValueFrom(interceptor.intercept(context, callHandler));

		expect(interceptor['logger'].log).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
	});

	it('sets X-Request-Id on the response', async () => {
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		await firstValueFrom(interceptor.intercept(context, callHandler));

		expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-test-123');
	});

	it('generates a request-id when X-Request-Id is missing', async () => {
		(mockRequest.get as jest.Mock).mockImplementation((header: string) => {
			if (header === 'User-Agent') return 'test-agent';
			return undefined;
		});
		const context = makeContext(mockRequest, mockResponse);
		const callHandler = makeCallHandler(of('ok'));

		await firstValueFrom(interceptor.intercept(context, callHandler));

		expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
	});
});

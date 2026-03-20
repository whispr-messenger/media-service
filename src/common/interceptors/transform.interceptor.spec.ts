import { of, firstValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

function makeContext(statusCode: number) {
	return {
		switchToHttp: () => ({
			getResponse: () => ({ statusCode }),
		}),
	} as any;
}

function makeCallHandler(data: unknown) {
	return { handle: () => of(data) } as any;
}

describe('TransformInterceptor', () => {
	let interceptor: TransformInterceptor<unknown>;

	beforeEach(() => {
		interceptor = new TransformInterceptor();
	});

	it('wraps data in { data, statusCode, message, timestamp }', async () => {
		const context = makeContext(200);
		const callHandler = makeCallHandler({ id: 1 });

		const result$ = interceptor.intercept(context, callHandler);
		const value = await firstValueFrom(result$);

		expect(value).toMatchObject({
			data: { id: 1 },
			statusCode: 200,
			message: 'Success',
		});
		expect(value).toHaveProperty('timestamp');
	});

	it('data equals the original handler return value', async () => {
		const context = makeContext(200);
		const payload = { name: 'test', size: 42 };
		const callHandler = makeCallHandler(payload);

		const result$ = interceptor.intercept(context, callHandler);
		const value = await firstValueFrom(result$);

		expect(value.data).toEqual(payload);
	});

	it('message is always "Success"', async () => {
		const context = makeContext(201);
		const callHandler = makeCallHandler(null);

		const result$ = interceptor.intercept(context, callHandler);
		const value = await firstValueFrom(result$);

		expect(value.message).toBe('Success');
	});

	it('statusCode comes from the response object', async () => {
		const context = makeContext(201);
		const callHandler = makeCallHandler({});

		const result$ = interceptor.intercept(context, callHandler);
		const value = await firstValueFrom(result$);

		expect(value.statusCode).toBe(201);
	});

	it('timestamp is a valid ISO date string', async () => {
		const context = makeContext(200);
		const callHandler = makeCallHandler('some data');

		const result$ = interceptor.intercept(context, callHandler);
		const value = await firstValueFrom(result$);

		expect(new Date(value.timestamp).toISOString()).toBe(value.timestamp);
	});
});

import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsGuard } from './metrics.guard';

function mockContext(headers: Record<string, string> = {}): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ headers }),
		}),
	} as unknown as ExecutionContext;
}

describe('MetricsGuard', () => {
	it('should allow access in development when no METRICS_API_KEY is configured', () => {
		const configService = {
			get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
				if (key === 'METRICS_API_KEY') return undefined;
				if (key === 'NODE_ENV') return 'development';
				return defaultValue;
			}),
		} as unknown as ConfigService;
		const guard = new MetricsGuard(configService);

		expect(guard.canActivate(mockContext())).toBe(true);
	});

	it('should allow access in test when no METRICS_API_KEY is configured', () => {
		const configService = {
			get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
				if (key === 'METRICS_API_KEY') return undefined;
				if (key === 'NODE_ENV') return 'test';
				return defaultValue;
			}),
		} as unknown as ConfigService;
		const guard = new MetricsGuard(configService);

		expect(guard.canActivate(mockContext())).toBe(true);
	});

	it('should deny access in production when no METRICS_API_KEY is configured', () => {
		const configService = {
			get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
				if (key === 'METRICS_API_KEY') return undefined;
				if (key === 'NODE_ENV') return defaultValue;
				return defaultValue;
			}),
		} as unknown as ConfigService;
		const guard = new MetricsGuard(configService);

		expect(guard.canActivate(mockContext())).toBe(false);
	});

	it('should allow access when correct key is provided', () => {
		const configService = { get: jest.fn().mockReturnValue('secret-key') } as unknown as ConfigService;
		const guard = new MetricsGuard(configService);

		expect(guard.canActivate(mockContext({ 'x-metrics-key': 'secret-key' }))).toBe(true);
	});

	it('should deny access when wrong key is provided', () => {
		const configService = { get: jest.fn().mockReturnValue('secret-key') } as unknown as ConfigService;
		const guard = new MetricsGuard(configService);

		expect(guard.canActivate(mockContext({ 'x-metrics-key': 'wrong' }))).toBe(false);
	});

	it('should deny access when no key is provided but METRICS_API_KEY is set', () => {
		const configService = { get: jest.fn().mockReturnValue('secret-key') } as unknown as ConfigService;
		const guard = new MetricsGuard(configService);

		expect(guard.canActivate(mockContext())).toBe(false);
	});
});

jest.mock('@nestjs/core', () => ({
	NestFactory: {
		create: jest.fn(),
	},
}));

jest.mock('helmet', () => {
	const mockHelmet = jest.fn(() => jest.fn());
	return { __esModule: true, default: mockHelmet };
});

jest.mock('./app.module', () => ({
	AppModule: class AppModule {},
}));

jest.mock('./swagger', () => ({
	createSwaggerDocumentation: jest.fn(),
}));

jest.mock('./interceptors', () => ({
	LoggingInterceptor: jest.fn().mockImplementation(() => ({})),
}));

describe('Bootstrap setup (main.ts)', () => {
	let mockUse: jest.Mock;
	let mockUseGlobalPipes: jest.Mock;
	let mockEnableShutdownHooks: jest.Mock;
	let mockListen: jest.Mock;
	let mockSetGlobalPrefix: jest.Mock;
	let mockEnableVersioning: jest.Mock;
	let mockUseGlobalInterceptors: jest.Mock;
	let mockEnableCors: jest.Mock;
	let mockConfigService: { get: jest.Mock };

	beforeEach(async () => {
		jest.resetModules();

		mockUse = jest.fn();
		mockUseGlobalPipes = jest.fn();
		mockEnableShutdownHooks = jest.fn();
		mockListen = jest.fn().mockResolvedValue(undefined);
		mockSetGlobalPrefix = jest.fn();
		mockEnableVersioning = jest.fn();
		mockUseGlobalInterceptors = jest.fn();
		mockEnableCors = jest.fn();

		mockConfigService = {
			get: jest.fn((key: string, def?: unknown) => {
				if (key === 'HTTP_PORT') return 3002;
				return def;
			}),
		};

		const mockApp = {
			use: mockUse,
			useGlobalPipes: mockUseGlobalPipes,
			enableShutdownHooks: mockEnableShutdownHooks,
			enableCors: mockEnableCors,
			listen: mockListen,
			setGlobalPrefix: mockSetGlobalPrefix,
			enableVersioning: mockEnableVersioning,
			useGlobalInterceptors: mockUseGlobalInterceptors,
			get: jest.fn().mockReturnValue(mockConfigService),
		};

		jest.doMock('@nestjs/core', () => ({
			NestFactory: { create: jest.fn().mockResolvedValue(mockApp) },
		}));

		jest.doMock('helmet', () => {
			const mockHelmet = jest.fn(() => jest.fn());
			return { __esModule: true, default: mockHelmet };
		});

		jest.doMock('./app.module', () => ({ AppModule: class AppModule {} }));
		jest.doMock('./swagger', () => ({ createSwaggerDocumentation: jest.fn() }));
		jest.doMock('./interceptors', () => ({
			LoggingInterceptor: jest.fn().mockImplementation(() => ({})),
		}));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should register helmet middleware in bootstrap', async () => {
		await import('./main');

		const helmet = (await import('helmet')).default;
		expect(mockUse).toHaveBeenCalledWith(expect.any(Function));
		expect(helmet).toBeDefined();
	});

	it('should register global ValidationPipe with whitelist and transform in bootstrap', async () => {
		await import('./main');

		expect(mockUseGlobalPipes).toHaveBeenCalledTimes(1);
		const pipeArg = mockUseGlobalPipes.mock.calls[0][0];
		expect(pipeArg.constructor.name).toBe('ValidationPipe');
	});

	it('should enable graceful shutdown hooks in bootstrap', async () => {
		await import('./main');

		expect(mockEnableShutdownHooks).toHaveBeenCalledTimes(1);
	});

	describe('CORS (WHISPR-945)', () => {
		it('does NOT enable CORS when CORS_ALLOWED_ORIGINS is unset', async () => {
			await import('./main');

			expect(mockEnableCors).not.toHaveBeenCalled();
		});

		it('registers the env allowlist when CORS_ALLOWED_ORIGINS is provided', async () => {
			mockConfigService.get.mockImplementation((key: string, def?: unknown) => {
				if (key === 'HTTP_PORT') return 3002;
				if (key === 'CORS_ALLOWED_ORIGINS')
					return ' https://whispr.devzeyu.com , http://localhost:19006 ';
				return def;
			});

			await import('./main');

			expect(mockEnableCors).toHaveBeenCalledWith({
				origin: ['https://whispr.devzeyu.com', 'http://localhost:19006'],
				methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
				allowedHeaders: [
					'Authorization',
					'Content-Type',
					'Accept',
					'Origin',
					'X-Requested-With',
					'X-Device-Type',
				],
				credentials: true,
			});
		});

		it('does not enable CORS when the env var contains only whitespace/commas', async () => {
			mockConfigService.get.mockImplementation((key: string, def?: unknown) => {
				if (key === 'HTTP_PORT') return 3002;
				if (key === 'CORS_ALLOWED_ORIGINS') return ' , , ';
				return def;
			});

			await import('./main');

			expect(mockEnableCors).not.toHaveBeenCalled();
		});
	});
});

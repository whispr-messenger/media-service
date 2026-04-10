describe('check-env', () => {
	let originalEnv: NodeJS.ProcessEnv;
	let consoleLogSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;
	let consoleWarnSpy: jest.SpyInstance;
	let runEnvChecks: () => void;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };

		// Mock console methods
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
		consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

		// Clear environment variables
		process.env = {};

		// Clear module cache to reset the global variables in check-env
		jest.resetModules();

		// Import the module fresh for each test
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		runEnvChecks = require('./check-env').default;
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;

		// Restore console methods
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	const allRequiredVars: Record<string, string> = {
		NODE_ENV: 'production',
		DB_HOST: 'localhost',
		DB_PORT: '5432',
		DB_USERNAME: 'user',
		DB_PASSWORD: 'password',
		DB_NAME: 'media_db',
		JWT_JWKS_URL: 'https://auth-service/.well-known/jwks.json',
		REDIS_HOST: 'localhost',
		REDIS_PORT: '6379',
		HTTP_PORT: '3001',
		S3_ACCESS_KEY_ID: 'minio-access-key',
		S3_SECRET_ACCESS_KEY: 'minio-secret-key',
		S3_ENDPOINT: 'http://localhost:9000',
	};

	function setAllRequired(): void {
		Object.assign(process.env, allRequiredVars);
	}

	describe('runEnvChecks in non-production with JWT_JWKS_FILE only', () => {
		it('should pass when JWT_JWKS_FILE is set without JWT_JWKS_URL', () => {
			setAllRequired();
			process.env.NODE_ENV = 'development';
			delete process.env.JWT_JWKS_URL;
			process.env.JWT_JWKS_FILE = 'scripts/dev/jwks.json';

			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_JWKS_FILE is set'));
		});
	});

	describe('runEnvChecks with all required variables', () => {
		beforeEach(() => {
			setAllRequired();
		});

		it('should pass when all required environment variables are set', () => {
			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('All required environment variables are set!')
			);
		});

		it('should log header and footer', () => {
			runEnvChecks();

			expect(consoleLogSpy).toHaveBeenCalledWith('==================================================');
			expect(consoleLogSpy).toHaveBeenCalledWith('  Whispr Media Service - Environment Check');
		});

		it('should check all required variables', () => {
			runEnvChecks();

			const requiredVars = [
				'NODE_ENV',
				'DB_HOST',
				'DB_PORT',
				'DB_USERNAME',
				'DB_PASSWORD',
				'DB_NAME',
				'JWT_JWKS_URL',
				'REDIS_HOST',
				'REDIS_PORT',
				'HTTP_PORT',
				'S3_ACCESS_KEY_ID',
				'S3_SECRET_ACCESS_KEY',
				'S3_ENDPOINT',
			];

			requiredVars.forEach((varName) => {
				expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`${varName} is set`));
			});
		});

		it('should not check Twilio variables', () => {
			runEnvChecks();

			expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('TWILIO_ACCOUNT_SID'));
			expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('TWILIO_AUTH_TOKEN'));
			expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('TWILIO_FROM_NUMBER'));
		});

		it('should not check JWT_PRIVATE_KEY', () => {
			runEnvChecks();

			expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('JWT_PRIVATE_KEY'));
		});

		it('should warn about missing optional variables', () => {
			runEnvChecks();

			expect(consoleWarnSpy).toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('optional environment variable(s) not set')
			);
		});
	});

	describe('runEnvChecks with optional variables', () => {
		beforeEach(() => {
			setAllRequired();

			// Set some optional variables
			process.env.DB_LOGGING = 'true';
			process.env.LOG_LEVEL = 'debug';
			process.env.METRICS_ENABLED = 'false';
		});

		it('should log optional variables when set', () => {
			runEnvChecks();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DB_LOGGING is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('LOG_LEVEL is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('METRICS_ENABLED is set'));
		});

		it('should still warn about unset optional variables', () => {
			runEnvChecks();

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('DB_URL is NOT set'));
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_PASSWORD is NOT set'));
		});
	});

	describe('runEnvChecks with missing required variables', () => {
		it('should throw error when NODE_ENV is missing', () => {
			setAllRequired();
			delete process.env.NODE_ENV;

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should throw error when database variables are missing', () => {
			setAllRequired();
			delete process.env.DB_HOST;
			delete process.env.DB_PORT;

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('DB_HOST is NOT set (REQUIRED)')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('DB_PORT is NOT set (REQUIRED)')
			);
		});

		it('should throw error when JWT_JWKS_URL is missing in production', () => {
			setAllRequired();
			delete process.env.JWT_JWKS_URL;

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('JWT_JWKS_URL is NOT set (REQUIRED)')
			);
		});

		it('should throw when JWT_JWKS_FILE is set in production', () => {
			setAllRequired();
			process.env.JWT_JWKS_FILE = 'scripts/dev/jwks.json';

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('JWT_JWKS_FILE must not be set in production')
			);
		});

		it('should throw error when Redis variables are missing', () => {
			setAllRequired();
			delete process.env.REDIS_HOST;
			delete process.env.REDIS_PORT;

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('REDIS_HOST is NOT set (REQUIRED)')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('REDIS_PORT is NOT set (REQUIRED)')
			);
		});

		it('should throw error when HTTP_PORT is missing', () => {
			setAllRequired();
			delete process.env.HTTP_PORT;

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('HTTP_PORT is NOT set (REQUIRED)')
			);
		});

		it('should throw error when S3 variables are missing', () => {
			setAllRequired();
			delete process.env.S3_ACCESS_KEY_ID;
			delete process.env.S3_SECRET_ACCESS_KEY;
			delete process.env.S3_ENDPOINT;

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('S3_ACCESS_KEY_ID is NOT set (REQUIRED)')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('S3_SECRET_ACCESS_KEY is NOT set (REQUIRED)')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('S3_ENDPOINT is NOT set (REQUIRED)')
			);
		});

		it('should report correct count of missing variables', () => {
			process.env.NODE_ENV = 'production';
			process.env.DB_HOST = 'localhost';

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('required environment variable(s) missing!')
			);
		});

		it('should throw error when multiple variables are missing', () => {
			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('required environment variable(s) missing!')
			);
		});
	});

	describe('runEnvChecks with empty string values', () => {
		it('should treat empty strings as missing required variables', () => {
			setAllRequired();
			process.env.NODE_ENV = '';

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should treat whitespace-only strings as missing required variables', () => {
			setAllRequired();
			process.env.NODE_ENV = '   ';

			expect(() => runEnvChecks()).toThrow('Missing required environment variables');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('NODE_ENV is NOT set (REQUIRED)')
			);
		});

		it('should treat empty optional variables as missing', () => {
			setAllRequired();
			process.env.LOG_LEVEL = '';

			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('LOG_LEVEL is NOT set'));
		});
	});

	describe('runEnvChecks output formatting', () => {
		beforeEach(() => {
			setAllRequired();
		});

		it('should display section headers', () => {
			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith('Checking REQUIRED environment variables...');
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('Checking OPTIONAL environment variables...')
			);
		});

		it('should use color codes in output', () => {
			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('\u001b[32m'));
		});

		it('should use red color for errors', () => {
			process.env = {};

			expect(() => runEnvChecks()).toThrow();

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('\u001b[31m'));
		});

		it('should use yellow color for warnings', () => {
			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('\u001b[33m'));
		});

		it('should display default values for optional variables', () => {
			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('will use default: false'));
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('will use default: info'));
		});
	});

	describe('runEnvChecks edge cases', () => {
		it('should handle when all variables including optional are set', () => {
			setAllRequired();

			// Set all optional variables
			process.env.DB_URL = 'postgresql://user:password@localhost:5432/media_db';
			process.env.DB_LOGGING = 'true';
			process.env.DB_MIGRATIONS_RUN = 'true';
			process.env.DB_SYNCHRONIZE = 'false';
			process.env.REDIS_PASSWORD = 'redis-pass';
			process.env.NODE_OPTIONS = '--max-old-space-size=4096';
			process.env.PORT = '3001';
			process.env.LOG_LEVEL = 'debug';
			process.env.METRICS_ENABLED = 'true';
			process.env.HEALTH_CHECK_TIMEOUT = '10000';

			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('optional environment variable(s) not set')
			);
		});

		it('should handle numeric values correctly', () => {
			setAllRequired();

			expect(() => runEnvChecks()).not.toThrow();

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DB_PORT is set'));
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_PORT is set'));
		});
	});
});

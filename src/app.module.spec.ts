import { envValidationSchema } from './config/env-validation.schema';

const validEnv = {
	NODE_ENV: 'test',
	HTTP_PORT: 3002,
	DB_HOST: 'localhost',
	DB_PORT: 5432,
	DB_USERNAME: 'postgres',
	DB_PASSWORD: 'password',
	DB_NAME: 'media',
	REDIS_HOST: 'redis',
	REDIS_PORT: 6379,
	JWT_JWKS_URL: 'https://auth-service/.well-known/jwks.json',
	S3_ACCESS_KEY_ID: 'access-key',
	S3_SECRET_ACCESS_KEY: 'secret-key',
	S3_ENDPOINT: 'https://minio:9000',
};

describe('AppModule env validation schema', () => {
	it('should pass with all required env vars present', () => {
		const { error } = envValidationSchema.validate(validEnv, { abortEarly: false });
		expect(error).toBeUndefined();
	});

	it('should apply default value "false" for DB_LOGGING when not set', () => {
		const { value, error } = envValidationSchema.validate(validEnv, { abortEarly: false });
		expect(error).toBeUndefined();
		expect(value.DB_LOGGING).toBe('false');
	});

	it('should apply default value "false" for DB_MIGRATIONS_RUN when not set', () => {
		const { value, error } = envValidationSchema.validate(validEnv, { abortEarly: false });
		expect(error).toBeUndefined();
		expect(value.DB_MIGRATIONS_RUN).toBe('false');
	});

	it('should apply default value "false" for DB_SYNCHRONIZE when not set', () => {
		const { value, error } = envValidationSchema.validate(validEnv, { abortEarly: false });
		expect(error).toBeUndefined();
		expect(value.DB_SYNCHRONIZE).toBe('false');
	});

	it('should apply default value "us-east-1" for S3_REGION when not set', () => {
		const { value, error } = envValidationSchema.validate(validEnv, { abortEarly: false });
		expect(error).toBeUndefined();
		expect(value.S3_REGION).toBe('us-east-1');
	});

	it('should fail when NODE_ENV is missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, NODE_ENV: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('NODE_ENV'))).toBe(true);
	});

	it('should fail when NODE_ENV has an invalid value', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, NODE_ENV: 'staging' },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('NODE_ENV'))).toBe(true);
	});

	it('should fail when DB_HOST is missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, DB_HOST: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('DB_HOST'))).toBe(true);
	});

	it('should fail when REDIS_HOST is missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, REDIS_HOST: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('REDIS_HOST'))).toBe(true);
	});

	it('should fail when JWT_JWKS_URL is missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, JWT_JWKS_URL: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('JWT_JWKS_URL'))).toBe(true);
	});

	it('should fail when JWT_JWKS_URL is not a valid URI', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, JWT_JWKS_URL: 'not-a-url' },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('JWT_JWKS_URL'))).toBe(true);
	});

	it('should fail when S3_ENDPOINT is missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, S3_ENDPOINT: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('S3_ENDPOINT'))).toBe(true);
	});

	it('should allow unknown env vars', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, SOME_EXTRA_VAR: 'extra' },
			{ abortEarly: false }
		);
		expect(error).toBeUndefined();
	});

	it('should allow optional REDIS_PASSWORD to be absent', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, REDIS_PASSWORD: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeUndefined();
	});

	it('should fail when multiple required vars are missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, DB_HOST: undefined, REDIS_HOST: undefined, JWT_JWKS_URL: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.length).toBeGreaterThanOrEqual(3);
	});
});

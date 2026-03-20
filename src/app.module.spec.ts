import * as Joi from 'joi';

const envValidationSchema = Joi.object({
	NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
	HTTP_PORT: Joi.number().port().required(),
	GRPC_PORT: Joi.number().port().required(),
	DB_HOST: Joi.string().required(),
	DB_PORT: Joi.number().port().required(),
	DB_USERNAME: Joi.string().required(),
	DB_PASSWORD: Joi.string().required(),
	DB_NAME: Joi.string().required(),
	DB_URL: Joi.string().optional(),
	DB_LOGGING: Joi.string().valid('true', 'false').default('false'),
	DB_MIGRATIONS_RUN: Joi.string().valid('true', 'false').default('false'),
	DB_SYNCHRONIZE: Joi.string().valid('true', 'false').default('false'),
	REDIS_HOST: Joi.string().required(),
	REDIS_PORT: Joi.number().port().required(),
	REDIS_PASSWORD: Joi.string().optional().allow(''),
	JWT_PUBLIC_KEY: Joi.string().required(),
	S3_ACCESS_KEY_ID: Joi.string().required(),
	S3_SECRET_ACCESS_KEY: Joi.string().required(),
	S3_ENDPOINT: Joi.string().required(),
	S3_REGION: Joi.string().optional().default('us-east-1'),
	USER_SERVICE_GRPC_URL: Joi.string().required(),
	MEDIA_SERVICE_GRPC_URL: Joi.string().required(),
}).options({ allowUnknown: true });

const validEnv = {
	NODE_ENV: 'test',
	HTTP_PORT: 3002,
	GRPC_PORT: 5002,
	DB_HOST: 'localhost',
	DB_PORT: 5432,
	DB_USERNAME: 'postgres',
	DB_PASSWORD: 'password',
	DB_NAME: 'media',
	REDIS_HOST: 'redis',
	REDIS_PORT: 6379,
	JWT_PUBLIC_KEY: 'some-public-key',
	S3_ACCESS_KEY_ID: 'access-key',
	S3_SECRET_ACCESS_KEY: 'secret-key',
	S3_ENDPOINT: 'http://minio:9000',
	USER_SERVICE_GRPC_URL: 'user-service:5001',
	MEDIA_SERVICE_GRPC_URL: 'media-service:5002',
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

	it('should fail when JWT_PUBLIC_KEY is missing', () => {
		const { error } = envValidationSchema.validate(
			{ ...validEnv, JWT_PUBLIC_KEY: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.some((d) => d.path.includes('JWT_PUBLIC_KEY'))).toBe(true);
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
			{ ...validEnv, DB_HOST: undefined, REDIS_HOST: undefined, JWT_PUBLIC_KEY: undefined },
			{ abortEarly: false }
		);
		expect(error).toBeDefined();
		expect(error!.details.length).toBeGreaterThanOrEqual(3);
	});
});

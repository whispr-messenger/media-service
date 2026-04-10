import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
	NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
	HTTP_PORT: Joi.number().port().required(),
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
	JWT_JWKS_URL: Joi.string().uri().optional(),
	/** Chemin relatif au cwd : charge le JWKS depuis le disque (prioritaire sur JWT_JWKS_URL). */
	JWT_JWKS_FILE: Joi.string().optional(),
	S3_ACCESS_KEY_ID: Joi.string().required(),
	S3_SECRET_ACCESS_KEY: Joi.string().required(),
	S3_ENDPOINT: Joi.string().required(),
	S3_REGION: Joi.string().optional().default('us-east-1'),
	SIGNED_URL_EXPIRY_SECONDS: Joi.number().integer().positive().max(604800).optional().default(604800),
	MESSAGE_BLOB_TTL_DAYS: Joi.number().integer().positive().optional().default(30),
	THUMBNAIL_BLOB_TTL_DAYS: Joi.number().integer().positive().optional().default(30),
})
	.custom((value, helpers) => {
		const file = value.JWT_JWKS_FILE && String(value.JWT_JWKS_FILE).trim() !== '';
		const url = value.JWT_JWKS_URL && String(value.JWT_JWKS_URL).trim() !== '';
		if (!file && !url) {
			return helpers.error('any.custom', {
				message: 'Either JWT_JWKS_URL or JWT_JWKS_FILE must be set',
			});
		}
		return value;
	})
	.custom((value, helpers) => {
		const file = value.JWT_JWKS_FILE && String(value.JWT_JWKS_FILE).trim() !== '';
		if (value.NODE_ENV === 'production' && file) {
			return helpers.error('any.custom', {
				message: 'JWT_JWKS_FILE is not allowed in production; use JWT_JWKS_URL',
			});
		}
		return value;
	})
	.options({ allowUnknown: true });

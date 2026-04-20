// Environment setup for Docker integration tests
// This file configures environment variables to connect to the Docker services

process.env.NODE_ENV = 'test';

// Database configuration - connects to Docker postgres service
process.env.DB_TYPE = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'whispr_user';
process.env.DB_PASSWORD = 'whispr_user_password';
process.env.DB_NAME = 'testing';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_LOGGING = 'false';

// Redis configuration - connects to Docker redis service
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// S3/MinIO configuration - connects to Docker MinIO service
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'minioadmin';
process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
process.env.S3_BUCKET = 'whispr-media';
process.env.S3_FORCE_PATH_STYLE = 'true';

// Auth configuration - JWKS URL is not needed for integration tests (mocked at guard level)
process.env.JWT_JWKS_URL = 'http://localhost:3001/auth/.well-known/jwks.json';

// Other configuration
process.env.HTTP_PORT = '3002';

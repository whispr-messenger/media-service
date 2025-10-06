// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://test:test@localhost:5432/media_service_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
process.env.GOOGLE_CLOUD_STORAGE_BUCKET = 'test-bucket';
process.env.AUTH_SERVICE_URL = 'localhost:50051';
process.env.MODERATION_SERVICE_URL = 'localhost:50052';

// Global test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('@google-cloud/storage');
jest.mock('@grpc/grpc-js');
jest.mock('redis');

// Mock ConfigService for tests
jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        'database.url': process.env.DATABASE_URL,
        'redis.url': process.env.REDIS_URL,
        'encryption.key': process.env.ENCRYPTION_KEY,
        'storage.projectId': process.env.GOOGLE_CLOUD_PROJECT_ID,
        'storage.bucket': process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
        'grpc.authService.url': process.env.AUTH_SERVICE_URL,
        'grpc.moderationService.url': process.env.MODERATION_SERVICE_URL,
        'media.maxFileSize': 100 * 1024 * 1024, // 100MB
      };
      return config[key] || defaultValue;
    }),
  })),
}));

import { ConfigService } from '@nestjs/config';
import { s3ModuleAsyncOptions } from './s3.config';

describe('s3ModuleAsyncOptions', () => {
	it('should include region from S3_REGION env var', () => {
		const configService = {
			get: jest.fn((key: string) => {
				const map: Record<string, string> = {
					S3_ACCESS_KEY_ID: 'test-key',
					S3_SECRET_ACCESS_KEY: 'test-secret',
					S3_ENDPOINT: 'http://localhost:9000',
					S3_REGION: 'us-east-1',
					S3_FORCE_PATH_STYLE: 'true',
				};
				return map[key];
			}),
		} as unknown as ConfigService;

		const factory = s3ModuleAsyncOptions.useFactory as (cs: ConfigService) => {
			config: Record<string, unknown>;
		};
		const options = factory(configService);

		expect(options.config.region).toBe('us-east-1');
	});
});

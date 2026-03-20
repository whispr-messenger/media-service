import { ConfigService } from '@nestjs/config';
import { cacheModuleAsyncOptions } from './cache.config';

jest.mock('@keyv/redis', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation((url: string) => ({ url })),
}));

function makeConfigService(overrides: Record<string, unknown> = {}): ConfigService {
	return {
		get: jest.fn((key: string, defaultValue?: unknown) => {
			if (key in overrides) {
				return overrides[key];
			}
			return defaultValue;
		}),
	} as unknown as ConfigService;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callFactory = (configService: ConfigService): Record<string, any> =>
	(cacheModuleAsyncOptions.useFactory as (cs: ConfigService) => Record<string, any>)(configService);

describe('cacheModuleAsyncOptions', () => {
	it('builds Redis URL from REDIS_HOST and REDIS_PORT', () => {
		const configService = makeConfigService({ REDIS_HOST: 'my-redis', REDIS_PORT: 6380 });

		const options = callFactory(configService);

		expect(options.stores[0].url).toBe('redis://my-redis:6380');
	});

	it('uses defaults "redis" and 6379 when vars are absent', () => {
		const configService = makeConfigService({});

		const options = callFactory(configService);

		expect(options.stores[0].url).toBe('redis://redis:6379');
	});

	it('returns ttl: 900 and max: 1000', () => {
		const configService = makeConfigService({});

		const options = callFactory(configService);

		expect(options.ttl).toBe(900);
		expect(options.max).toBe(1000);
	});

	it('stores array has exactly one element (the KeyvRedis instance)', () => {
		const configService = makeConfigService({});

		const options = callFactory(configService);

		expect(options.stores).toHaveLength(1);
	});
});

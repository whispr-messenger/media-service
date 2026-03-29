import { ConfigService } from '@nestjs/config';
import { typeOrmModuleAsyncOptions } from './typeorm.config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callFactory = (configService: ConfigService): Promise<Record<string, any>> =>
	(typeOrmModuleAsyncOptions.useFactory as (cs: ConfigService) => Promise<Record<string, any>>)(
		configService
	);

function makeConfigService(overrides: Record<string, string | undefined>): ConfigService {
	return {
		get: jest.fn((key: string, defaultValue?: unknown) => {
			if (key in overrides) {
				return overrides[key];
			}
			return defaultValue;
		}),
	} as unknown as ConfigService;
}

describe('typeOrmModuleAsyncOptions', () => {
	it('uses individual env vars when DB_URL is absent', async () => {
		const configService = makeConfigService({
			DB_URL: undefined,
			DB_HOST: 'db-host',
			DB_PORT: '5433',
			DB_USERNAME: 'myuser',
			DB_PASSWORD: 'mypassword',
			DB_NAME: 'mydb',
		});

		const options = await callFactory(configService);

		expect(options.host).toBe('db-host');
		expect(options.port).toBe('5433');
		expect(options.username).toBe('myuser');
		expect(options.password).toBe('mypassword');
		expect(options.database).toBe('mydb');
	});

	it('parses DB_URL connection string correctly', async () => {
		const configService = makeConfigService({
			DB_URL: 'postgres://dbuser:dbpass@db.example.com:5434/myappdb',
		});

		const options = await callFactory(configService);

		expect(options.host).toBe('db.example.com');
		expect(options.port).toBe(5434);
		expect(options.username).toBe('dbuser');
		expect(options.password).toBe('dbpass');
		expect(options.database).toBe('myappdb');
	});

	it('sets logging to true when DB_LOGGING=true', async () => {
		const configService = makeConfigService({
			DB_URL: undefined,
			DB_LOGGING: 'true',
		});

		const options = await callFactory(configService);

		expect(options.logging).toBe(true);
	});

	it('sets logging to false when DB_LOGGING is not set', async () => {
		const configService = makeConfigService({
			DB_URL: undefined,
		});

		const options = await callFactory(configService);

		expect(options.logging).toBe(false);
	});

	it('sets migrationsRun to true when DB_MIGRATIONS_RUN=true', async () => {
		const configService = makeConfigService({
			DB_URL: undefined,
			DB_MIGRATIONS_RUN: 'true',
		});

		const options = await callFactory(configService);

		expect(options.migrationsRun).toBe(true);
	});

	it('sets synchronize to true when DB_SYNCHRONIZE=true', async () => {
		const configService = makeConfigService({
			DB_URL: undefined,
			DB_SYNCHRONIZE: 'true',
		});

		const options = await callFactory(configService);

		expect(options.synchronize).toBe(true);
	});

	it('always sets type to postgres', async () => {
		const configService = makeConfigService({
			DB_URL: undefined,
		});

		const options = await callFactory(configService);

		expect(options.type).toBe('postgres');
	});

	it('falls back to port 5432 when DB_URL has no explicit port', async () => {
		const configService = makeConfigService({
			DB_URL: 'postgres://user:pass@host/dbname',
		});

		const options = await callFactory(configService);

		expect(options.port).toBe(5432);
	});
});

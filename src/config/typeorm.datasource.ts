import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { DataSource } from 'typeorm';
import { Media } from '../modules/media/entities/media.entity';
import { UserQuota } from '../modules/media/entities/user-quota.entity';
import { MediaAccessLog } from '../modules/media/entities/media-access-log.entity';

// Aligné sur AppModule (ConfigModule) : le dernier fichier l’emporte
const root = process.cwd();
dotenvConfig({ path: resolve(root, '.env.development') });
dotenvConfig({ path: resolve(root, '.env.local'), override: true });
dotenvConfig({ path: resolve(root, '.env'), override: true });

const DEFAULT_POSTGRES_PORT = 5432;

interface PostgresConnection {
	host: string;
	port: number;
	username: string;
	password: string;
	database: string;
}

/** Valeurs par défaut pour les migrations CLI si le .env ne définit pas DB_* (surchargées par l’env). */
const DEFAULT_LOCAL_POSTGRES: PostgresConnection = {
	host: 'localhost',
	port: 5432,
	username: 'media_app',
	password: 'whispr',
	database: 'whispr_media',
};

function trimEnv(value: string | undefined): string | undefined {
	const v = value?.trim();
	return v === '' ? undefined : v;
}

function parseDatabaseUrl(url: string): PostgresConnection {
	const parsed = new URL(url);
	const port = parsed.port ? Number.parseInt(parsed.port, 10) : DEFAULT_POSTGRES_PORT;
	return {
		host: parsed.hostname,
		port: Number.isFinite(port) ? port : DEFAULT_POSTGRES_PORT,
		username: decodeURIComponent(parsed.username),
		password: decodeURIComponent(parsed.password),
		database: parsed.pathname.replace(/^\//, ''),
	};
}

const dbUrl = trimEnv(process.env.DB_URL);
const connection: PostgresConnection = dbUrl
	? parseDatabaseUrl(dbUrl)
	: {
			host: trimEnv(process.env.DB_HOST) ?? DEFAULT_LOCAL_POSTGRES.host,
			port:
				Number.parseInt(trimEnv(process.env.DB_PORT) ?? String(DEFAULT_LOCAL_POSTGRES.port), 10) ||
				DEFAULT_LOCAL_POSTGRES.port,
			username: trimEnv(process.env.DB_USERNAME) ?? DEFAULT_LOCAL_POSTGRES.username,
			password: trimEnv(process.env.DB_PASSWORD) ?? DEFAULT_LOCAL_POSTGRES.password,
			database: trimEnv(process.env.DB_NAME) ?? DEFAULT_LOCAL_POSTGRES.database,
		};

export default new DataSource({
	type: 'postgres',
	...connection,
	logging: process.env.DB_LOGGING === 'true',
	entities: [Media, UserQuota, MediaAccessLog],
	migrations: [__dirname + '/migrations/*{.ts,.js}'],
	synchronize: false,
});

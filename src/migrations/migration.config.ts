import { DataSource } from 'typeorm';
import { Media } from '../modules/media/entities/media.entity';
import { UserQuota } from '../modules/media/entities/user-quota.entity';
import { MediaAccessLog } from '../modules/media/entities/media-access-log.entity';

const DEFAULT_POSTGRES_PORT = 5432;

function parseDatabaseUrl(url: string) {
	const parsed = new URL(url);
	return {
		host: parsed.hostname,
		port: parseInt(parsed.port, 10) || DEFAULT_POSTGRES_PORT,
		username: parsed.username,
		password: parsed.password,
		database: parsed.pathname.slice(1),
	};
}

const databaseUrl = process.env.DB_URL;
const dbConfig = databaseUrl
	? parseDatabaseUrl(databaseUrl)
	: {
			host: process.env.DB_HOST || 'localhost',
			port: parseInt(process.env.DB_PORT, 10) || DEFAULT_POSTGRES_PORT,
			username: process.env.DB_USERNAME || 'postgres',
			password: process.env.DB_PASSWORD || 'password',
			database: process.env.DB_NAME || 'media_service',
		};

export default new DataSource({
	type: 'postgres',
	...dbConfig,
	entities: [Media, UserQuota, MediaAccessLog],
	migrations: [__dirname + '/../config/migrations/*{.ts,.js}'],
});

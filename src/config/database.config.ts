import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url:
    process.env.DATABASE_URL ||
    'postgresql://media_user:media_password@localhost:5432/media_db',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'media_user',
  password: process.env.DB_PASSWORD || 'media_password',
  database: process.env.DB_NAME || 'media_db',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
}));

export type DatabaseConfig = ReturnType<typeof databaseConfig>;

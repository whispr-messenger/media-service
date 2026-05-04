import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createSwaggerDocumentation } from './swagger';
import { LoggingInterceptor } from './interceptors';
import { JsonLogger } from './utils/json-logger';

async function bootstrap() {
	// WHISPR-1068 : LOG_FORMAT=json active la sortie JSON structurée pour
	// Loki/ELK ; on conserve le logger natif coloré pour le dev local.
	const useJsonLogger = (process.env.LOG_FORMAT ?? '').toLowerCase() === 'json';
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: useJsonLogger ? new JsonLogger({ service: 'media-service' }) : undefined,
	});
	const configService = app.get(ConfigService);
	const logger = new Logger('Bootstrap');
	const port = configService.get<number>('HTTP_PORT', 3002);
	const globalPrefix = 'media';

	app.use(helmet());

	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

	app.setGlobalPrefix(globalPrefix, {
		exclude: ['metrics'],
	});

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
		prefix: 'v',
	});

	createSwaggerDocumentation(app, port, configService, globalPrefix);

	// WHISPR-945: drop the previous `origin: true` — combined with
	// `credentials: true` it reflected every Origin header back, which is a
	// CSRF vector against any authenticated browser session. We now read a
	// comma-separated allowlist from CORS_ALLOWED_ORIGINS (matching the env
	// var used by user-service and scheduling-service). When the env is
	// unset we fail closed and emit no CORS headers — native iOS/Android
	// clients are unaffected, only browser-based clients are blocked.
	const allowedOrigins = String(configService.get<string>('CORS_ALLOWED_ORIGINS', '') ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	if (allowedOrigins.length > 0) {
		app.enableCors({
			origin: allowedOrigins,
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			allowedHeaders: [
				'Authorization',
				'Content-Type',
				'Accept',
				'Origin',
				'X-Requested-With',
				'X-Device-Type',
			],
			credentials: true,
		});
		logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
	} else {
		logger.warn(
			'CORS_ALLOWED_ORIGINS is not set — browser clients will be blocked. ' +
				'Configure the env var (comma-separated) to enable cross-origin access.'
		);
	}

	app.useGlobalInterceptors(new LoggingInterceptor());

	app.enableShutdownHooks();

	await app.listen(port);

	logger.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();

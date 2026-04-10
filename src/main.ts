import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createSwaggerDocumentation } from './swagger';
import { LoggingInterceptor } from './interceptors';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
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

	app.useGlobalInterceptors(new LoggingInterceptor());

	app.enableShutdownHooks();

	await app.listen(port);

	logger.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();

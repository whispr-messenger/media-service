import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { createSwaggerDocumentation } from './swagger';

jest.mock('@nestjs/swagger', () => {
	const mockDocumentBuilder = {
		setTitle: jest.fn().mockReturnThis(),
		setDescription: jest.fn().mockReturnThis(),
		setVersion: jest.fn().mockReturnThis(),
		addServer: jest.fn().mockReturnThis(),
		addBearerAuth: jest.fn().mockReturnThis(),
		addApiKey: jest.fn().mockReturnThis(),
		build: jest.fn().mockReturnValue({}),
	};

	return {
		DocumentBuilder: jest.fn().mockImplementation(() => mockDocumentBuilder),
		SwaggerModule: {
			createDocument: jest.fn().mockReturnValue({}),
			setup: jest.fn(),
		},
		SwaggerCustomOptions: jest.fn(),
	};
});

describe('createSwaggerDocumentation', () => {
	let app: NestExpressApplication;
	let configService: ConfigService;

	beforeEach(() => {
		jest.clearAllMocks();
		app = {} as NestExpressApplication;
		configService = { get: jest.fn() } as unknown as ConfigService;
	});

	it('calls SwaggerModule.setup when SWAGGER_ENABLED is true', () => {
		(configService.get as jest.Mock).mockReturnValue(true);

		createSwaggerDocumentation(app, 3000, configService);

		expect(SwaggerModule.setup).toHaveBeenCalledTimes(1);
	});

	it('does NOT call SwaggerModule.setup when SWAGGER_ENABLED is false', () => {
		(configService.get as jest.Mock).mockReturnValue(false);

		createSwaggerDocumentation(app, 3000, configService);

		expect(SwaggerModule.setup).not.toHaveBeenCalled();
	});

	it('calls SwaggerModule.setup with "swagger" as the first argument when globalPrefix is provided', () => {
		(configService.get as jest.Mock).mockReturnValue(true);

		createSwaggerDocumentation(app, 3000, configService, 'media');

		expect(SwaggerModule.setup).toHaveBeenCalledWith(
			'swagger',
			app,
			expect.any(Function),
			expect.any(Object)
		);
	});

	it('calls SwaggerModule.setup when no globalPrefix is provided', () => {
		(configService.get as jest.Mock).mockReturnValue(true);

		createSwaggerDocumentation(app, 3000, configService);

		expect(SwaggerModule.setup).toHaveBeenCalledTimes(1);
	});
});

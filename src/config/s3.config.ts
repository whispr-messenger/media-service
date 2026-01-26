import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3ModuleAsyncOptions, S3ModuleOptions } from 'nestjs-s3';

function s3ModuleOptionsFactory(configService: ConfigService): S3ModuleOptions {
	return {
		config: {
			credentials: {
				accessKeyId: configService.get('S3_ACCESS_KEY_ID'),
				secretAccessKey: configService.get('S3_SECRET_ACCESS_KEY'),
			},
			endpoint: configService.get('S3_ENDPOINT'),
			forcePathStyle: configService.get('S3_FORCE_PATH_STYLE', false),
		},
	};
}

export const s3ModuleAsyncOptions: S3ModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: s3ModuleOptionsFactory,
	inject: [ConfigService],
};

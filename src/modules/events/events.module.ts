import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsService } from './events.service';

@Module({
	imports: [
		ClientsModule.registerAsync([
			{
				name: 'EVENTS_REDIS_CLIENT',
				imports: [ConfigModule],
				inject: [ConfigService],
				useFactory: (configService: ConfigService) => ({
					transport: Transport.REDIS,
					options: {
						host: configService.get<string>('REDIS_HOST', 'localhost'),
						port: configService.get<number>('REDIS_PORT', 6379),
						password: configService.get<string>('REDIS_PASSWORD', undefined),
					},
				}),
			},
		]),
	],
	providers: [EventsService],
	exports: [EventsService],
})
export class EventsModule {}

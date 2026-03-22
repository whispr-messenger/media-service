import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';

@Injectable()
export class EventsService implements OnModuleDestroy {
	private readonly logger = new Logger(EventsService.name);

	constructor(@Inject('REDIS_CLIENT') private readonly client: ClientProxy) {}

	async onModuleInit(): Promise<void> {
		try {
			await this.client.connect();
			this.logger.log('Redis transport client connected');
		} catch (error) {
			this.logger.error(`Failed to connect Redis transport: ${(error as Error).message}`);
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.client.close();
	}

	emit(pattern: string, data: any): void {
		this.client.emit(pattern, data).subscribe({
			error: (err) => this.logger.error(`Failed to emit event "${pattern}": ${err.message}`),
		});
	}
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
	readonly registry = new Registry();

	readonly uploadsTotal: Counter;
	readonly downloadsTotal: Counter;
	readonly deletesTotal: Counter;

	constructor() {
		this.uploadsTotal = new Counter({
			name: 'media_uploads_total',
			help: 'Total number of media uploads',
			registers: [this.registry],
		});

		this.downloadsTotal = new Counter({
			name: 'media_downloads_total',
			help: 'Total number of media downloads',
			registers: [this.registry],
		});

		this.deletesTotal = new Counter({
			name: 'media_deletes_total',
			help: 'Total number of media deletes',
			registers: [this.registry],
		});
	}

	onModuleInit(): void {
		collectDefaultMetrics({ register: this.registry });
	}

	async getMetrics(): Promise<string> {
		return this.registry.metrics();
	}

	getContentType(): string {
		return this.registry.contentType;
	}
}

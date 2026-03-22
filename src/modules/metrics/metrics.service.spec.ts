import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
	let service: MetricsService;

	beforeEach(() => {
		service = new MetricsService();
		service.onModuleInit();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should return metrics string', async () => {
		const metrics = await service.getMetrics();
		expect(typeof metrics).toBe('string');
		expect(metrics).toContain('media_uploads_total');
		expect(metrics).toContain('media_downloads_total');
		expect(metrics).toContain('media_deletes_total');
	});

	it('should return content type', () => {
		const contentType = service.getContentType();
		expect(contentType).toContain('text/plain');
	});

	it('should increment upload counter', async () => {
		service.uploadsTotal.inc();
		const metrics = await service.getMetrics();
		expect(metrics).toContain('media_uploads_total 1');
	});

	it('should increment download counter', async () => {
		service.downloadsTotal.inc();
		const metrics = await service.getMetrics();
		expect(metrics).toContain('media_downloads_total 1');
	});

	it('should increment delete counter', async () => {
		service.deletesTotal.inc();
		const metrics = await service.getMetrics();
		expect(metrics).toContain('media_deletes_total 1');
	});
});

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
	let controller: MetricsController;
	let metricsService: MetricsService;

	beforeEach(() => {
		metricsService = new MetricsService();
		metricsService.onModuleInit();
		controller = new MetricsController(metricsService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should return metrics with correct content type', async () => {
		const mockRes = {
			setHeader: jest.fn(),
			send: jest.fn(),
		} as any;

		await controller.getMetrics(mockRes);

		expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/plain'));
		expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('media_uploads_total'));
	});
});

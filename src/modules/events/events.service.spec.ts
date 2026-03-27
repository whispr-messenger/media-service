import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';

const mockClient = {
	connect: jest.fn().mockResolvedValue(undefined),
	close: jest.fn().mockResolvedValue(undefined),
	emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
};

describe('EventsService', () => {
	let service: EventsService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [EventsService, { provide: 'REDIS_CLIENT', useValue: mockClient }],
		}).compile();

		service = module.get<EventsService>(EventsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should connect on module init', async () => {
		await service.onModuleInit();
		expect(mockClient.connect).toHaveBeenCalled();
	});

	it('should close client on module destroy', async () => {
		await service.onModuleDestroy();
		expect(mockClient.close).toHaveBeenCalled();
	});

	it('should emit events via the Redis client', () => {
		service.emit('test.event', { key: 'value' });
		expect(mockClient.emit).toHaveBeenCalledWith('test.event', { key: 'value' });
	});

	it('should handle emit errors gracefully', () => {
		const errorSubscribe = jest.fn((handlers) => {
			if (handlers.error) handlers.error(new Error('emit failed'));
		});
		mockClient.emit.mockReturnValue({ subscribe: errorSubscribe });

		expect(() => service.emit('fail.event', {})).not.toThrow();
	});
});

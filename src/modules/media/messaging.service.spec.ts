import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MessagingService } from './messaging.service';

const mockCache = {
	get: jest.fn(),
	set: jest.fn(),
};

const mockConfig = {
	get: jest.fn((key: string, defaultVal?: unknown) => {
		const cfg: Record<string, unknown> = {
			MESSAGING_SERVICE_URL: 'http://messaging:4000',
			INTERNAL_API_TOKEN: 'test-token',
			MESSAGING_SERVICE_TIMEOUT_MS: 3000,
		};
		return cfg[key] ?? defaultVal;
	}),
};

describe('MessagingService', () => {
	let service: MessagingService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MessagingService,
				{ provide: ConfigService, useValue: mockConfig },
				{ provide: CACHE_MANAGER, useValue: mockCache },
			],
		}).compile();

		service = module.get<MessagingService>(MessagingService);
	});

	describe('isConversationE2EE()', () => {
		it('retourne la valeur cachee sans appel reseau', async () => {
			mockCache.get.mockResolvedValue(true);

			const result = await service.isConversationE2EE('conv-123');

			expect(result).toBe(true);
			expect(mockCache.get).toHaveBeenCalledWith('e2ee:conv:conv-123');
		});

		it('retourne false si cache retourne false', async () => {
			mockCache.get.mockResolvedValue(false);

			const result = await service.isConversationE2EE('conv-456');

			expect(result).toBe(false);
		});

		it('appelle messaging-service et met en cache quand cache miss', async () => {
			mockCache.get.mockResolvedValue(undefined);
			mockCache.set.mockResolvedValue(undefined);

			const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ conversation_id: 'conv-789', e2ee_enabled: true }),
			} as Response);

			const result = await service.isConversationE2EE('conv-789');

			expect(result).toBe(true);
			expect(mockCache.set).toHaveBeenCalledWith('e2ee:conv:conv-789', true, 60_000);
			fetchSpy.mockRestore();
		});

		it('retourne false (fail-open) si messaging-service retourne 404', async () => {
			mockCache.get.mockResolvedValue(undefined);
			mockCache.set.mockResolvedValue(undefined);

			const fetchSpy = jest
				.spyOn(globalThis, 'fetch')
				.mockResolvedValue({ ok: false, status: 404 } as Response);

			const result = await service.isConversationE2EE('conv-inconnue');

			expect(result).toBe(false);
			fetchSpy.mockRestore();
		});

		it('retourne false (fail-open) si messaging-service retourne 5xx', async () => {
			mockCache.get.mockResolvedValue(undefined);
			mockCache.set.mockResolvedValue(undefined);

			const fetchSpy = jest
				.spyOn(globalThis, 'fetch')
				.mockResolvedValue({ ok: false, status: 503 } as Response);

			const result = await service.isConversationE2EE('conv-down');

			expect(result).toBe(false);
			fetchSpy.mockRestore();
		});

		it('retourne false (fail-open) si fetch lance une exception reseau', async () => {
			mockCache.get.mockResolvedValue(undefined);
			mockCache.set.mockResolvedValue(undefined);

			const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

			const result = await service.isConversationE2EE('conv-network-error');

			expect(result).toBe(false);
			fetchSpy.mockRestore();
		});

		it('retourne false (fail-open) si MESSAGING_SERVICE_URL non configure', async () => {
			mockCache.get.mockResolvedValue(undefined);
			mockCache.set.mockResolvedValue(undefined);

			const configNoUrl = {
				get: jest.fn((key: string, defaultVal?: unknown) => {
					if (key === 'MESSAGING_SERVICE_URL') return '';
					return defaultVal;
				}),
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					MessagingService,
					{ provide: ConfigService, useValue: configNoUrl },
					{ provide: CACHE_MANAGER, useValue: mockCache },
				],
			}).compile();

			const svcNoUrl = module.get<MessagingService>(MessagingService);
			const result = await svcNoUrl.isConversationE2EE('conv-no-url');

			expect(result).toBe(false);
		});
	});
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwksService } from './jwks.service';

async function flushPromises(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
}

const ES256_JWK = {
	kty: 'EC',
	use: 'sig',
	alg: 'ES256',
	crv: 'P-256',
	x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU',
	y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0',
};

describe('JwksService', () => {
	let service: JwksService;

	const mockConfigService = {
		get: jest.fn().mockReturnValue(undefined),
		getOrThrow: jest.fn().mockReturnValue('https://auth-service/.well-known/jwks.json'),
	};

	beforeEach(async () => {
		jest.useFakeTimers();

		const module: TestingModule = await Test.createTestingModule({
			providers: [JwksService, { provide: ConfigService, useValue: mockConfigService }],
		}).compile();

		service = module.get<JwksService>(JwksService);
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	describe('isReady()', () => {
		it('should return false before the key is loaded', () => {
			expect(service.isReady()).toBe(false);
		});
	});

	describe('getPublicKey()', () => {
		it('should return null before the key is loaded', () => {
			expect(service.getPublicKey()).toBeNull();
		});
	});

	describe('loadPublicKey()', () => {
		it('should load the ES256 public key and mark service as ready', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [ES256_JWK] }),
			} as unknown as Response);

			await service.loadPublicKey();

			expect(service.isReady()).toBe(true);
			expect(service.getPublicKey()).not.toBeNull();
		});

		it('should accept a key with only use=sig (no alg field)', async () => {
			const keyWithUseSig = { ...ES256_JWK, alg: undefined };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyWithUseSig] }),
			} as unknown as Response);

			await service.loadPublicKey();

			expect(service.isReady()).toBe(true);
		});

		it('should accept a key with only alg=ES256 (no use field)', async () => {
			const keyWithAlgOnly = { ...ES256_JWK, use: undefined };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyWithAlgOnly] }),
			} as unknown as Response);

			await service.loadPublicKey();

			expect(service.isReady()).toBe(true);
		});

		it('should throw when fetch fails with a network error', async () => {
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

			await expect(service.loadPublicKey()).rejects.toThrow('JWKS fetch failed: Network error');
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the fetch times out', async () => {
			const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);

			await expect(service.loadPublicKey()).rejects.toThrow(
				'JWKS fetch failed: timed out after 5000ms'
			);
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the JWKS endpoint returns a non-200 status', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				status: 503,
			} as unknown as Response);

			await expect(service.loadPublicKey()).rejects.toThrow('JWKS endpoint returned HTTP 503');
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the JWKS document contains no EC P-256 key', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [{ kty: 'RSA' }] }),
			} as unknown as Response);

			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
			expect(service.isReady()).toBe(false);
		});

		it('should throw when the EC key has no use or alg field', async () => {
			const keyNoUseOrAlg = { kty: 'EC', crv: 'P-256', x: ES256_JWK.x, y: ES256_JWK.y };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyNoUseOrAlg] }),
			} as unknown as Response);

			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
		});

		it('should throw when the EC key is missing x/y coordinates', async () => {
			const keyMissingCoords = { kty: 'EC', use: 'sig', alg: 'ES256', crv: 'P-256' };
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [keyMissingCoords] }),
			} as unknown as Response);

			await expect(service.loadPublicKey()).rejects.toThrow(
				'ES256 (EC P-256) key in JWKS is missing required coordinates (x/y)'
			);
		});

		it('should throw when the JWKS document has an empty keys array', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [] }),
			} as unknown as Response);

			await expect(service.loadPublicKey()).rejects.toThrow(
				'No ES256 (EC P-256) key found in JWKS document'
			);
		});

		it('should throw when the response body is not valid JSON', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
			} as unknown as Response);

			await expect(service.loadPublicKey()).rejects.toThrow('Failed to parse JWKS response');
		});
	});

	describe('onModuleInit()', () => {
		it('should mark service as ready when JWKS loads successfully on first attempt', async () => {
			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [ES256_JWK] }),
			} as unknown as Response);

			void service.onModuleInit();
			await flushPromises();

			expect(service.isReady()).toBe(true);
		});

		it('should retry and succeed on the second attempt', async () => {
			const fetchMock = jest
				.spyOn(globalThis, 'fetch')
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce({
					ok: true,
					json: jest.fn().mockResolvedValue({ keys: [ES256_JWK] }),
				} as unknown as Response);

			void service.onModuleInit();
			// first attempt fires and fails
			await flushPromises();
			// advance past the 1s backoff delay
			await jest.advanceTimersByTimeAsync(1_000);
			// second attempt fires and succeeds
			await flushPromises();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(service.isReady()).toBe(true);
		});

		it('should remain not ready after the first failed attempt', async () => {
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

			void service.onModuleInit();
			await flushPromises();

			expect(service.isReady()).toBe(false);

			// stop background loop to prevent open handles in subsequent tests
			service.onModuleDestroy();
			await jest.runAllTimersAsync();
		});

		it('should stop retrying after onModuleDestroy is called', async () => {
			const fetchMock = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

			void service.onModuleInit();
			// first attempt fires
			await flushPromises();
			service.onModuleDestroy();
			await jest.runAllTimersAsync();

			// only the first attempt should have fired before destroy cancelled the timer
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(service.isReady()).toBe(false);
		});

		it('should load the key in background retry after all initial attempts fail', async () => {
			const fetchMock = jest
				.spyOn(globalThis, 'fetch')
				// fail all 10 initial attempts
				.mockRejectedValue(new Error('Network error'));

			void service.onModuleInit();
			// exhaust the 10 initial attempts (total delay: 1+2+4+8+16+30+30+30+30 = 151s)
			await jest.advanceTimersByTimeAsync(200_000);
			await flushPromises();

			// service is not ready yet
			expect(service.isReady()).toBe(false);

			// now make the background retry succeed
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: jest.fn().mockResolvedValue({ keys: [ES256_JWK] }),
			} as unknown as Response);

			// advance past the 30s background retry interval
			await jest.advanceTimersByTimeAsync(30_000);
			await flushPromises();

			expect(service.isReady()).toBe(true);

			service.onModuleDestroy();
			await jest.runAllTimersAsync();
		});

		it('should stop background retry loop when destroyed after sleep', async () => {
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

			void service.onModuleInit();
			// exhaust initial attempts
			await jest.advanceTimersByTimeAsync(200_000);
			await flushPromises();

			// destroy mid-background-loop (after the sleep but before next fetch)
			service.onModuleDestroy();
			await jest.runAllTimersAsync();

			expect(service.isReady()).toBe(false);
		});
	});
});

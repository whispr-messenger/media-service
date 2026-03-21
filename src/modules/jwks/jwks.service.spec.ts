import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwksService } from './jwks.service';

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
		getOrThrow: jest.fn().mockReturnValue('https://auth-service/.well-known/jwks.json'),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [JwksService, { provide: ConfigService, useValue: mockConfigService }],
		}).compile();

		service = module.get<JwksService>(JwksService);
		jest.clearAllMocks();
	});

	afterEach(() => {
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

		it('should throw when fetch fails with a network error', async () => {
			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

			await expect(service.loadPublicKey()).rejects.toThrow('JWKS fetch failed: Network error');
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
		it('should call loadPublicKey on module init', async () => {
			const spy = jest.spyOn(service, 'loadPublicKey').mockResolvedValue(undefined);

			await service.onModuleInit();

			expect(spy).toHaveBeenCalledTimes(1);
		});
	});
});

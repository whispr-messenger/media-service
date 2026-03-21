import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwksService } from '../jwks/jwks.service';

const mockJwksService = {
	getPublicKey: jest.fn(),
};

const mockJwtService = {
	verifyAsync: jest.fn(),
};

const mockCacheManager = {
	get: jest.fn(),
};

const MOCK_PUBLIC_KEY = {
	export: jest.fn().mockReturnValue('-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----'),
};

const VALID_PAYLOAD = {
	sub: 'user-uuid-1',
	jti: 'token-jti-1',
	deviceId: 'device-id-1',
	fingerprint: 'fp-abc',
};

function buildContext(authHeader?: string): ExecutionContext {
	const request = {
		headers: authHeader ? { authorization: authHeader } : {},
		user: undefined as unknown,
	};
	return {
		switchToHttp: () => ({
			getRequest: () => request,
		}),
	} as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
	let guard: JwtAuthGuard;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockJwksService.getPublicKey.mockReturnValue(MOCK_PUBLIC_KEY);
		mockJwtService.verifyAsync.mockResolvedValue(VALID_PAYLOAD);
		mockCacheManager.get.mockResolvedValue(null);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				JwtAuthGuard,
				{ provide: JwksService, useValue: mockJwksService },
				{ provide: JwtService, useValue: mockJwtService },
				{ provide: CACHE_MANAGER, useValue: mockCacheManager },
			],
		}).compile();

		guard = module.get<JwtAuthGuard>(JwtAuthGuard);
	});

	it('should allow a request with a valid token and no revocation', async () => {
		const ctx = buildContext('Bearer valid-token');
		const result = await guard.canActivate(ctx);
		expect(result).toBe(true);
	});

	it('should inject user context into the request', async () => {
		const request = { headers: { authorization: 'Bearer valid-token' }, user: undefined as unknown };
		const ctx = {
			switchToHttp: () => ({ getRequest: () => request }),
		} as unknown as ExecutionContext;

		await guard.canActivate(ctx);

		expect(request.user).toEqual({
			userId: VALID_PAYLOAD.sub,
			jti: VALID_PAYLOAD.jti,
			deviceId: VALID_PAYLOAD.deviceId,
			fingerprint: VALID_PAYLOAD.fingerprint,
		});
	});

	it('should throw 401 when Authorization header is missing', async () => {
		const ctx = buildContext(undefined);
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when Authorization header does not start with Bearer', async () => {
		const ctx = buildContext('Basic dXNlcjpwYXNz');
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when public key is not loaded', async () => {
		mockJwksService.getPublicKey.mockReturnValue(null);
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when JWT verification fails', async () => {
		mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
		const ctx = buildContext('Bearer bad-token');
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when payload is missing required fields', async () => {
		mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' }); // missing jti and deviceId
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when token jti is revoked in Redis', async () => {
		mockCacheManager.get.mockImplementation((key: string) => {
			if (key === `revoked:${VALID_PAYLOAD.jti}`) return Promise.resolve('1');
			return Promise.resolve(null);
		});
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should throw 401 when device is revoked in Redis', async () => {
		mockCacheManager.get.mockImplementation((key: string) => {
			if (key === `revoked_device:${VALID_PAYLOAD.deviceId}`) return Promise.resolve('1');
			return Promise.resolve(null);
		});
		const ctx = buildContext('Bearer valid-token');
		await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
	});

	it('should check both revoked:{jti} and revoked_device:{deviceId} in Redis', async () => {
		const ctx = buildContext('Bearer valid-token');
		await guard.canActivate(ctx);

		expect(mockCacheManager.get).toHaveBeenCalledWith(`revoked:${VALID_PAYLOAD.jti}`);
		expect(mockCacheManager.get).toHaveBeenCalledWith(`revoked_device:${VALID_PAYLOAD.deviceId}`);
	});
});

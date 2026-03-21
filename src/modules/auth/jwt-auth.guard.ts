import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { JwksService } from '../jwks/jwks.service';

interface JwtPayload {
	sub: string;
	jti: string;
	deviceId: string;
	fingerprint: string;
	[key: string]: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
	private readonly logger = new Logger(JwtAuthGuard.name);

	constructor(
		private readonly jwksService: JwksService,
		private readonly jwtService: JwtService,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const token = this.extractBearerToken(request);

		if (!token) {
			throw new UnauthorizedException();
		}

		const publicKey = this.jwksService.getPublicKey();
		if (!publicKey) {
			this.logger.error('Public key not loaded — rejecting request');
			throw new UnauthorizedException();
		}

		let payload: JwtPayload;
		try {
			payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
				publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
				algorithms: ['ES256'],
			});
		} catch (error) {
			this.logger.debug(`JWT verification failed: ${(error as Error).message}`);
			throw new UnauthorizedException();
		}

		const { sub, jti, deviceId, fingerprint } = payload;

		if (!sub || !jti || !deviceId) {
			throw new UnauthorizedException();
		}

		const [tokenRevoked, deviceRevoked] = await Promise.all([
			this.cacheManager.get<string>(`revoked:${jti}`),
			this.cacheManager.get<string>(`revoked_device:${deviceId}`),
		]);

		if (tokenRevoked !== undefined && tokenRevoked !== null) {
			throw new UnauthorizedException();
		}
		if (deviceRevoked !== undefined && deviceRevoked !== null) {
			throw new UnauthorizedException();
		}

		request['user'] = { userId: sub, jti, deviceId, fingerprint };

		return true;
	}

	private extractBearerToken(request: Request): string | null {
		const authHeader = request.headers.authorization;
		if (!authHeader?.startsWith('Bearer ')) {
			return null;
		}
		return authHeader.slice(7);
	}
}

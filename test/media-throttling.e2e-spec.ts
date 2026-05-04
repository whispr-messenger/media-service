import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType, ExecutionContext, CanActivate } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { MediaController } from '../src/modules/media/media.controller';
import { MediaService } from '../src/modules/media/media.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

// WHISPR-1192: vérifie que l'override @Throttle({ short: 30/1s }) sur les
// routes de lecture média encaisse bien une rafale de 10 requêtes (cas réel:
// un écran de chat qui rend 10 avatars d'un coup) tout en bloquant à 31 req/s.

class AllowAllGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest();
		req.user = { userId: '00000000-0000-0000-0000-000000000001' };
		return true;
	}
}

const SHORT_THROTTLER: ThrottlerOptions = { name: 'short', ttl: 1000, limit: 3 };
const MEDIUM_THROTTLER: ThrottlerOptions = { name: 'medium', ttl: 10000, limit: 20 };
const LONG_THROTTLER: ThrottlerOptions = { name: 'long', ttl: 60000, limit: 100 };

const mockMediaService = {
	getBlob: jest.fn().mockResolvedValue({
		url: 'https://example.com/blob',
		expiresAt: new Date(Date.now() + 60_000),
	}),
	getThumbnail: jest.fn().mockResolvedValue({
		url: 'https://example.com/thumb',
		expiresAt: new Date(Date.now() + 60_000),
	}),
	streamBlob: jest.fn(),
	streamThumbnail: jest.fn(),
	getMetadata: jest.fn(),
	upload: jest.fn(),
	share: jest.fn(),
	delete: jest.fn(),
	getUserQuota: jest.fn(),
	getUserMedia: jest.fn(),
	logAccess: jest.fn(),
};

async function buildApp(): Promise<INestApplication> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [
			// Pas de storage → @nestjs/throttler utilise ThrottlerStorageService
			// (in-memory), suffisant pour un test isolé sans Redis.
			ThrottlerModule.forRoot({
				throttlers: [SHORT_THROTTLER, MEDIUM_THROTTLER, LONG_THROTTLER],
			}),
		],
		controllers: [MediaController],
		providers: [
			{ provide: MediaService, useValue: mockMediaService },
			{ provide: APP_GUARD, useClass: ThrottlerGuard },
			{ provide: APP_GUARD, useClass: AllowAllGuard },
		],
	}).compile();

	const app = moduleFixture.createNestApplication();
	app.setGlobalPrefix('media');
	app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
	await app.init();
	return app;
}

describe('Media throttling (e2e) — WHISPR-1192', () => {
	const MEDIA_ID = '11111111-1111-1111-1111-111111111111';

	describe('burst within the new limit', () => {
		let app: INestApplication;

		beforeAll(async () => {
			app = await buildApp();
		});

		afterAll(async () => {
			if (app) await app.close();
		});

		it('accepts 10 consecutive GET /:id/blob requests without 429', async () => {
			const statuses: number[] = [];
			for (let i = 0; i < 10; i++) {
				const res = await request(app.getHttpServer()).get(`/media/v1/${MEDIA_ID}/blob`);
				statuses.push(res.status);
			}

			expect(statuses.every((s) => s === 200)).toBe(true);
		});
	});

	describe('burst above the new limit', () => {
		let app: INestApplication;

		beforeAll(async () => {
			app = await buildApp();
		});

		afterAll(async () => {
			if (app) await app.close();
		});

		it('returns at least one 429 when 31 requests hit /:id/blob within 1 second', async () => {
			// Sériel pour éviter ECONNRESET sur supertest, mais sans pause entre
			// requêtes : la fenêtre du palier `short` est de 1 s, donc 31 GET en
			// boucle restent largement dedans.
			const statuses: number[] = [];
			for (let i = 0; i < 31; i++) {
				const res = await request(app.getHttpServer())
					.get(`/media/v1/${MEDIA_ID}/blob`)
					.ok(() => true);
				statuses.push(res.status);
			}

			const tooManyCount = statuses.filter((s) => s === 429).length;
			expect(tooManyCount).toBeGreaterThanOrEqual(1);
		});
	});
});

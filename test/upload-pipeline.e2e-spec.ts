import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CanActivate } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

// Bypass JWT guard for integration tests — auth is validated at gateway level in production.
// The media-service trusts the x-user-id header forwarded by the gateway.
class AllowAllGuard implements CanActivate {
	canActivate(): boolean {
		return true;
	}
}

// Minimal valid JPEG (SOI + APP0 marker)
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
// Minimal valid PNG (PNG signature)
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const USER_ID_1 = '00000000-0000-0000-0000-000000000001';
const USER_ID_2 = '00000000-0000-0000-0000-000000000002';

describe('Upload Pipeline (e2e, Docker)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(APP_GUARD)
			.useClass(AllowAllGuard)
			.compile();

		app = moduleFixture.createNestApplication();
		app.setGlobalPrefix('media');
		app.enableVersioning({
			type: VersioningType.URI,
			defaultVersion: '1',
			prefix: 'v',
		});
		await app.init();
	}, 60000);

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	// =========================================================================
	// Successful upload — message context
	// =========================================================================

	it('uploads a JPEG in message context and returns mediaId + quota update', async () => {
		// Build a buffer that passes magic-bytes validation (needs >8 valid JPEG bytes)
		const fileBuffer = Buffer.concat([JPEG_MAGIC, Buffer.alloc(512)]);

		const res = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_1)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' })
			.expect(201);

		expect(res.body).toHaveProperty('mediaId');
		expect(typeof res.body.mediaId).toBe('string');
		expect(res.body.context).toBe('message');
		expect(res.body.size).toBeGreaterThan(0);
		// message context blobs are private — no public URL
		expect(res.body.url).toBeNull();
	}, 30000);

	// =========================================================================
	// Successful upload — avatar context (public URL returned)
	// =========================================================================

	it('uploads a JPEG avatar and returns a public URL', async () => {
		const fileBuffer = Buffer.concat([JPEG_MAGIC, Buffer.alloc(512)]);

		const res = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_1)
			.field('context', 'avatar')
			.attach('file', fileBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
			.expect(201);

		expect(res.body.mediaId).toBeDefined();
		expect(res.body.context).toBe('avatar');
		// avatar is a public context — a URL should be returned
		expect(res.body.url).toBeTruthy();
	}, 30000);

	// =========================================================================
	// Deduplication — same blob uploaded twice returns the same mediaId
	// =========================================================================

	it('deduplicates identical blobs for the same user+context', async () => {
		const fileBuffer = Buffer.concat([
			PNG_MAGIC,
			Buffer.from('dedup-test-unique-content-12345'),
			Buffer.alloc(256),
		]);

		const res1 = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_2)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'dedup.png', contentType: 'image/png' })
			.expect(201);

		const res2 = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_2)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'dedup.png', contentType: 'image/png' })
			.expect(201);

		expect(res1.body.mediaId).toBe(res2.body.mediaId);
	}, 30000);

	// =========================================================================
	// Magic bytes mismatch — 415 Unsupported Media Type
	// =========================================================================

	it('rejects upload when magic bytes do not match declared MIME type (415)', async () => {
		// Send PNG bytes but declare it as image/jpeg
		const fileBuffer = Buffer.concat([PNG_MAGIC, Buffer.alloc(512)]);

		const res = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_1)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'fake.jpg', contentType: 'image/jpeg' });

		expect(res.status).toBe(415);
	}, 30000);

	// =========================================================================
	// Missing file — 400 Bad Request
	// =========================================================================

	it('rejects upload with no file attached (400)', async () => {
		const res = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_1)
			.field('context', 'message');

		expect(res.status).toBe(400);
	}, 30000);

	// =========================================================================
	// Missing x-user-id header — 400 Bad Request
	// =========================================================================

	it('rejects upload without x-user-id header (400)', async () => {
		const fileBuffer = Buffer.concat([JPEG_MAGIC, Buffer.alloc(512)]);

		const res = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

		expect(res.status).toBe(400);
	}, 30000);

	// =========================================================================
	// Metadata retrieval after upload
	// =========================================================================

	it('retrieves metadata for an uploaded file', async () => {
		const fileBuffer = Buffer.concat([JPEG_MAGIC, Buffer.alloc(256)]);

		const uploadRes = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_1)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'meta-test.jpg', contentType: 'image/jpeg' })
			.expect(201);

		const mediaId = uploadRes.body.mediaId;

		const metaRes = await request(app.getHttpServer())
			.get(`/media/v1/${mediaId}`)
			.set('x-user-id', USER_ID_1)
			.expect(200);

		expect(metaRes.body.id).toBe(mediaId);
		expect(metaRes.body.ownerId).toBe(USER_ID_1);
		expect(metaRes.body.context).toBe('message');
		expect(metaRes.body.isActive).toBe(true);
	}, 30000);

	// =========================================================================
	// Metadata access control — other user cannot read message media
	// =========================================================================

	it('forbids non-owner from reading message media metadata (403)', async () => {
		const fileBuffer = Buffer.concat([JPEG_MAGIC, Buffer.alloc(256)]);

		const uploadRes = await request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', USER_ID_1)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'private.jpg', contentType: 'image/jpeg' });

		expect(uploadRes.status).toBe(201);
		const mediaId = uploadRes.body.mediaId;

		const metaRes = await request(app.getHttpServer())
			.get(`/media/v1/${mediaId}`)
			.set('x-user-id', USER_ID_2);

		expect(metaRes.status).toBe(403);
	}, 30000);
});

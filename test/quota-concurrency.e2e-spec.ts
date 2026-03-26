import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CanActivate } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

// Bypass JWT guard for integration tests.
class AllowAllGuard implements CanActivate {
	canActivate(): boolean {
		return true;
	}
}

// Minimal valid JPEG (SOI + APP0 marker)
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

// Use a dedicated user UUID per test suite to avoid cross-test quota state leakage
const SEMAPHORE_USER = '10000000-0000-0000-0000-000000000001';
const QUOTA_USER = '10000000-0000-0000-0000-000000000002';
const ATOMICITY_USER = '10000000-0000-0000-0000-000000000003';

describe('Quota Concurrency (e2e, Docker)', () => {
	let app: INestApplication;
	let dataSource: DataSource;

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

		dataSource = app.get(DataSource);
	}, 60000);

	afterAll(async () => {
		if (app) {
			await app.close();
		}
	});

	// =========================================================================
	// Helper: build a unique JPEG buffer (different hash each call)
	// =========================================================================

	function makeJpegBuffer(seed: number): Buffer {
		const noise = Buffer.alloc(512);
		noise.writeUInt32BE(seed, 0);
		return Buffer.concat([JPEG_MAGIC, noise]);
	}

	function uploadJpeg(userId: string, fileBuffer: Buffer): Promise<any> {
		return request(app.getHttpServer())
			.post('/media/v1/upload')
			.set('x-user-id', userId)
			.field('context', 'message')
			.attach('file', fileBuffer, { filename: 'file.jpg', contentType: 'image/jpeg' });
	}

	// =========================================================================
	// Semaphore test: 4th concurrent upload must be rejected (429)
	// MAX_CONCURRENT_UPLOADS = 3
	// =========================================================================

	it('blocks the 4th concurrent upload with 429 Too Many Requests', async () => {
		// Each upload uses a unique buffer so deduplication doesn't short-circuit them
		const uploads = [1, 2, 3, 4].map((seed) => uploadJpeg(SEMAPHORE_USER, makeJpegBuffer(seed)));

		const results = await Promise.all(uploads);
		const statuses = results.map((r) => (r as any).status);

		// Exactly one of the four must be 429
		const tooManyCount = statuses.filter((s) => s === 429).length;
		expect(tooManyCount).toBeGreaterThanOrEqual(1);

		// The other three must succeed
		const successCount = statuses.filter((s) => s === 201).length;
		expect(successCount).toBe(3);
	}, 60000);

	// =========================================================================
	// No double-counting: after N successful uploads, quota reflects exactly N
	// =========================================================================

	it('increments quota storage_used exactly once per successful upload', async () => {
		// Sequential uploads to avoid semaphore interference
		const uploadedSizes: number[] = [];
		const results: Array<any> = [];
		for (let i = 1; i <= 3; i++) {
			const buf = makeJpegBuffer(100 + i);
			const res = await uploadJpeg(QUOTA_USER, buf);
			results.push(res);
			if (res.status === 201) {
				uploadedSizes.push(res.body.size as number);
			}
		}

		const successCount = results.filter((r) => r.status === 201).length;
		expect(successCount).toBe(3);

		// Query PostgreSQL directly to verify storage_used
		const rows = await dataSource.query(
			`SELECT storage_used, files_count FROM media.user_quotas WHERE user_id = $1`,
			[QUOTA_USER]
		);

		expect(rows.length).toBe(1);

		const storageUsed = Number(rows[0].storage_used);
		const filesCount = Number(rows[0].files_count);

		// storage_used must equal the sum of reported blob sizes (no double-counting)
		const expectedStorage = uploadedSizes.reduce((acc, s) => acc + s, 0);
		expect(storageUsed).toBe(expectedStorage);
		expect(filesCount).toBe(3);
	}, 60000);

	// =========================================================================
	// Atomic update correctness: concurrent uploads must not lose increments
	// =========================================================================

	it('atomically records all quota increments without race conditions', async () => {
		// Fire 3 concurrent uploads (within semaphore limit) with distinct buffers
		const buffers = [1, 2, 3].map((seed) => makeJpegBuffer(200 + seed));
		const uploads = buffers.map((buf) => uploadJpeg(ATOMICITY_USER, buf));
		const results = await Promise.all(uploads);

		const successful = results.filter((r) => (r as any).status === 201);
		const successCount = successful.length;
		expect(successCount).toBe(3);

		// Allow a short settling period for async quota writes to complete
		await new Promise((resolve) => globalThis.setTimeout(resolve, 500));

		const rows = await dataSource.query(
			`SELECT storage_used, files_count FROM media.user_quotas WHERE user_id = $1`,
			[ATOMICITY_USER]
		);

		expect(rows.length).toBe(1);

		const storageUsed = Number(rows[0].storage_used);
		const filesCount = Number(rows[0].files_count);

		// Every successful upload must be counted — no lost writes
		const expectedStorage = successful.reduce((acc: number, r: any) => acc + (r.body.size as number), 0);
		expect(storageUsed).toBe(expectedStorage);
		expect(filesCount).toBe(successCount);
	}, 60000);
});

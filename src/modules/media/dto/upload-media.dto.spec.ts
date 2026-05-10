import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
	BlobUrlResponseDto,
	MediaContext,
	MediaMetadataDto,
	ShareMediaDto,
	ShareMediaResponseDto,
	ThumbnailUrlResponseDto,
	UploadMediaDto,
	UploadMediaResponseDto,
} from './upload-media.dto';

describe('UploadMediaDto', () => {
	it('accepts a valid dto with no fields set', async () => {
		const dto = plainToInstance(UploadMediaDto, {});
		expect(await validate(dto)).toHaveLength(0);
	});

	it('accepts a valid context, ownerId and sharedWith array', async () => {
		const dto = plainToInstance(UploadMediaDto, {
			context: MediaContext.MESSAGE,
			ownerId: '11111111-1111-4111-8111-111111111111',
			sharedWith: ['22222222-2222-4222-8222-222222222222'],
		});
		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects an unknown context value', async () => {
		const dto = plainToInstance(UploadMediaDto, { context: 'unknown' });
		const errors = await validate(dto);
		expect(errors.some((e) => e.property === 'context')).toBe(true);
	});

	it('rejects a non-uuid ownerId', async () => {
		const dto = plainToInstance(UploadMediaDto, { ownerId: 'not-a-uuid' });
		const errors = await validate(dto);
		expect(errors.some((e) => e.property === 'ownerId')).toBe(true);
	});

	describe('sharedWith parsing', () => {
		it('parses a CSV string into an array', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: '11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222',
			});
			expect(dto.sharedWith).toEqual([
				'11111111-1111-4111-8111-111111111111',
				'22222222-2222-4222-8222-222222222222',
			]);
			expect(await validate(dto)).toHaveLength(0);
		});

		it('parses a JSON-encoded array string', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: '["11111111-1111-4111-8111-111111111111"]',
			});
			expect(dto.sharedWith).toEqual(['11111111-1111-4111-8111-111111111111']);
		});

		it('falls back to the raw trimmed string when JSON.parse fails', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: '[not-valid-json',
			});
			expect(dto.sharedWith).toBe('[not-valid-json');
		});

		it('falls back to the raw trimmed string when JSON parses to a non-array', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: '[]extra',
			});
			expect(dto.sharedWith).toBe('[]extra');
		});

		it('passes through an existing array unchanged', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: ['11111111-1111-4111-8111-111111111111'],
			});
			expect(dto.sharedWith).toEqual(['11111111-1111-4111-8111-111111111111']);
		});

		it('coerces non-string array members to strings', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: [123, 456],
			});
			expect(dto.sharedWith).toEqual(['123', '456']);
		});

		it('returns undefined when sharedWith is null, empty string or undefined', async () => {
			const cases: Array<unknown> = [null, '', undefined];
			for (const value of cases) {
				const dto = plainToInstance(UploadMediaDto, { sharedWith: value });
				expect(dto.sharedWith).toBeUndefined();
			}
		});

		it('filters out empty CSV entries', async () => {
			const dto = plainToInstance(UploadMediaDto, {
				sharedWith: '11111111-1111-4111-8111-111111111111,,22222222-2222-4222-8222-222222222222,',
			});
			expect(dto.sharedWith).toEqual([
				'11111111-1111-4111-8111-111111111111',
				'22222222-2222-4222-8222-222222222222',
			]);
		});

		it('returns the raw value when not a string, array, null, or empty', async () => {
			const dto = plainToInstance(UploadMediaDto, { sharedWith: { not: 'expected' } });
			expect(dto.sharedWith).toEqual({ not: 'expected' });
		});
	});
});

describe('ShareMediaDto', () => {
	it('accepts a valid array of UUIDs', async () => {
		const dto = plainToInstance(ShareMediaDto, {
			userIds: ['11111111-1111-4111-8111-111111111111'],
		});
		expect(await validate(dto)).toHaveLength(0);
	});

	it('rejects a non-uuid entry', async () => {
		const dto = plainToInstance(ShareMediaDto, { userIds: ['not-a-uuid'] });
		expect((await validate(dto)).length).toBeGreaterThan(0);
	});
});

describe('Response DTO instantiation', () => {
	it('UploadMediaResponseDto holds assigned values', () => {
		const dto = new UploadMediaResponseDto();
		dto.media_id = 'm-1';
		dto.url = 'https://example';
		dto.thumbnail_url = null;
		dto.expires_at = new Date(0);
		dto.context = MediaContext.AVATAR;
		dto.size = 42;
		expect(dto).toMatchObject({ media_id: 'm-1', size: 42, context: 'avatar' });
	});

	it('BlobUrlResponseDto, ThumbnailUrlResponseDto, ShareMediaResponseDto, MediaMetadataDto can be assigned', () => {
		const blob = new BlobUrlResponseDto();
		blob.url = 'u';
		blob.expiresAt = null;
		expect(blob.url).toBe('u');

		const thumb = new ThumbnailUrlResponseDto();
		thumb.url = null;
		thumb.expiresAt = null;
		expect(thumb.url).toBeNull();

		const share = new ShareMediaResponseDto();
		share.sharedWith = [];
		expect(share.sharedWith).toEqual([]);

		const meta = new MediaMetadataDto();
		meta.id = '1';
		meta.ownerId = '2';
		meta.context = MediaContext.MESSAGE;
		meta.contentType = 'image/png';
		meta.blobSize = 1;
		meta.expiresAt = null;
		meta.isActive = true;
		meta.createdAt = new Date(0);
		meta.hasThumbnail = false;
		expect(meta.contentType).toBe('image/png');
	});
});

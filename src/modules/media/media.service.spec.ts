import { Test, TestingModule } from '@nestjs/testing';
import {
	ForbiddenException,
	HttpException,
	NotFoundException,
	PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getS3ConnectionToken } from 'nestjs-s3';
import { MediaService } from './media.service';
import { MediaRepository } from './repositories/media.repository';
import { StorageService } from './storage.service';
import { QuotaService } from './quota.service';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { Media } from './entities/media.entity';
import { MediaContext } from './dto/upload-media.dto';
import { REDIS_CLIENT } from './media.module';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
	getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/file'),
}));

const makeMedia = (overrides: Partial<Media> = {}): Media =>
	Object.assign(new Media(), {
		id: 'media-uuid-1',
		ownerId: 'user-uuid-1',
		context: MediaContext.MESSAGE,
		contentType: 'image/jpeg',
		blobSize: 1024,
		storagePath: 'messages/user-uuid-1/media-uuid-1.bin',
		thumbnailPath: null,
		expiresAt: null,
		signedUrlExpiresAt: null,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	} as Media);

const mockMediaRepository = {
	save: jest.fn(),
	findById: jest.fn(),
	updateSignedUrlExpiry: jest.fn(),
	softDelete: jest.fn(),
};

const mockStorageService = {
	bucket: 'test-bucket',
	buildPath: jest.fn().mockReturnValue('messages/user-uuid-1/id.bin'),
	getPublicUrl: jest.fn((path: string) => `http://minio:9000/test-bucket/${path}`),
	upload: jest.fn().mockResolvedValue(undefined),
	download: jest.fn(),
	delete: jest.fn().mockResolvedValue(undefined),
};

const mockQuotaService = {
	enforceQuota: jest.fn().mockResolvedValue(undefined),
	recordUpload: jest.fn().mockResolvedValue(undefined),
	recordDelete: jest.fn().mockResolvedValue(undefined),
};

const mockCache = {
	get: jest.fn().mockResolvedValue(null),
	set: jest.fn().mockResolvedValue(undefined),
	del: jest.fn().mockResolvedValue(undefined),
};

const mockAccessLogRepo = {
	save: jest.fn().mockResolvedValue(undefined),
};

const mockRedisClient = {
	incr: jest.fn().mockResolvedValue(1),
	decr: jest.fn().mockResolvedValue(0),
	expire: jest.fn().mockResolvedValue(1),
	del: jest.fn().mockResolvedValue(1),
};

const mockS3 = {
	putObject: jest.fn().mockResolvedValue({}),
	getObject: jest.fn(),
	send: jest.fn().mockResolvedValue({}),
};

const mockConfigService = {
	get: jest.fn((key: string, defaultValue?: unknown) => {
		const config: Record<string, unknown> = {
			SIGNED_URL_EXPIRY_SECONDS: 604800,
			MESSAGE_BLOB_TTL_DAYS: 30,
		};
		return config[key] ?? defaultValue;
	}),
};

// A minimal JPEG buffer (just the magic bytes)
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

describe('MediaService', () => {
	let service: MediaService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MediaService,
				{ provide: MediaRepository, useValue: mockMediaRepository },
				{ provide: StorageService, useValue: mockStorageService },
				{ provide: QuotaService, useValue: mockQuotaService },
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: CACHE_MANAGER, useValue: mockCache },
				{ provide: getRepositoryToken(MediaAccessLog), useValue: mockAccessLogRepo },
				{ provide: REDIS_CLIENT, useValue: mockRedisClient },
			],
		}).compile();

		service = module.get<MediaService>(MediaService);
	});

	describe('upload()', () => {
		const file: Express.Multer.File = {
			originalname: 'photo.jpg',
			mimetype: 'image/jpeg',
			size: 1024,
			buffer: jpegBuffer,
		} as unknown as Express.Multer.File;

		it('should upload file and return UploadMediaResponseDto', async () => {
			const media = makeMedia();
			mockMediaRepository.save.mockResolvedValue(media);

			const result = await service.upload('user-uuid-1', file, MediaContext.MESSAGE);

			expect(mockQuotaService.enforceQuota).toHaveBeenCalledWith('user-uuid-1', 1024);
			expect(mockStorageService.upload).toHaveBeenCalled();
			expect(mockMediaRepository.save).toHaveBeenCalled();
			expect(mockQuotaService.recordUpload).toHaveBeenCalled();
			expect(result).toHaveProperty('mediaId');
		});

		it('throws 429 HttpException when semaphore is at max', async () => {
			// Simulate counter already at MAX+1 after INCR (4 = over the limit of 3)
			mockRedisClient.incr.mockResolvedValueOnce(4);

			await expect(service.upload('user-uuid-1', file, MediaContext.MESSAGE)).rejects.toThrow(
				HttpException
			);
		});

		it('returns existing media on dedup cache hit', async () => {
			// Semaphore now uses redisClient.incr, so only the dedup key hits cache.get
			mockCache.get.mockResolvedValueOnce('existing-media-id'); // dedup hit

			const existingMedia = makeMedia({ id: 'existing-media-id' });
			mockMediaRepository.findById.mockResolvedValue(existingMedia);

			const result = await service.upload('user-uuid-1', file, MediaContext.MESSAGE);

			expect(result.mediaId).toBe('existing-media-id');
			expect(mockStorageService.upload).not.toHaveBeenCalled();
		});

		it('throws PayloadTooLargeException when quota is exceeded', async () => {
			// semaphore is fine (INCR returns 1), but quota check fails
			mockQuotaService.enforceQuota.mockRejectedValue(new PayloadTooLargeException('quota exceeded'));

			await expect(service.upload('user-uuid-1', file, MediaContext.MESSAGE)).rejects.toThrow(
				PayloadTooLargeException
			);
		});
	});

	describe('getMetadata()', () => {
		it('returns media metadata for the owner', async () => {
			const media = makeMedia({ ownerId: 'user-uuid-1' });
			mockCache.get.mockResolvedValue(null); // no cache
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getMetadata('media-uuid-1', 'user-uuid-1');

			expect(result.id).toBe('media-uuid-1');
		});

		it('throws NotFoundException for non-existent media', async () => {
			mockCache.get.mockResolvedValue(null);
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.getMetadata('missing', 'user-uuid-1')).rejects.toThrow(NotFoundException);
		});

		it('throws ForbiddenException when non-owner requests message media', async () => {
			const media = makeMedia({ ownerId: 'owner-1', context: MediaContext.MESSAGE });
			mockCache.get.mockResolvedValue(null);
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getMetadata('media-uuid-1', 'other-user')).rejects.toThrow(
				ForbiddenException
			);
		});

		it('allows any user to read avatar metadata', async () => {
			const media = makeMedia({ ownerId: 'owner-1', context: MediaContext.AVATAR });
			mockCache.get.mockResolvedValue(null);
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getMetadata('media-uuid-1', 'any-user')).resolves.toBeDefined();
		});
	});

	describe('delete()', () => {
		it('soft deletes media, releases quota, and invalidates cache', async () => {
			const media = makeMedia();
			mockMediaRepository.findById.mockResolvedValue(media);

			await service.delete('media-uuid-1', 'user-uuid-1');

			expect(mockMediaRepository.softDelete).toHaveBeenCalledWith('media-uuid-1');
			expect(mockCache.del).toHaveBeenCalledWith('media:meta:media-uuid-1');
			expect(mockQuotaService.recordDelete).toHaveBeenCalledWith('user-uuid-1', 1024);
		});

		it('throws ForbiddenException when non-owner tries to delete', async () => {
			const media = makeMedia({ ownerId: 'owner-1' });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.delete('media-uuid-1', 'other-user')).rejects.toThrow(ForbiddenException);
		});

		it('throws NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.delete('missing', 'user-uuid-1')).rejects.toThrow(NotFoundException);
		});
	});

	describe('getBlobUrl()', () => {
		it('returns signed URL for message media owner', async () => {
			const media = makeMedia();
			mockMediaRepository.findById.mockResolvedValue(media);
			mockMediaRepository.updateSignedUrlExpiry.mockResolvedValue(undefined);

			const url = await service.getBlobUrl('media-uuid-1', 'user-uuid-1');

			expect(url).toBe('https://presigned.url/file');
		});

		it('throws ForbiddenException for non-owner on message media', async () => {
			const media = makeMedia({ ownerId: 'owner-1' });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getBlobUrl('media-uuid-1', 'other-user')).rejects.toThrow(
				ForbiddenException
			);
		});
	});

	describe('getThumbnailUrl()', () => {
		it('throws NotFoundException when no thumbnail exists', async () => {
			const media = makeMedia({ thumbnailPath: null });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getThumbnailUrl('media-uuid-1', 'user-uuid-1')).rejects.toThrow(
				NotFoundException
			);
		});

		it('returns signed URL when thumbnail exists', async () => {
			const media = makeMedia({ thumbnailPath: 'thumbnails/user-uuid-1/media-uuid-1.bin' });
			mockMediaRepository.findById.mockResolvedValue(media);

			const url = await service.getThumbnailUrl('media-uuid-1', 'user-uuid-1');

			expect(url).toBe('https://presigned.url/file');
		});
	});
});

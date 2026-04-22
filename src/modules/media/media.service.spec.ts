import { Test, TestingModule } from '@nestjs/testing';
import {
	ForbiddenException,
	HttpException,
	NotFoundException,
	PayloadTooLargeException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getS3ConnectionToken } from 'nestjs-s3';
import { MediaService } from './media.service';
import { MediaRepository } from './repositories/media.repository';
import { StorageService } from './storage.service';
import { QuotaService } from './quota.service';
import { GroupService } from './group.service';
import { MediaAccessLog } from './entities/media-access-log.entity';
import { Media } from './entities/media.entity';
import { MediaContext } from './dto/upload-media.dto';
import { REDIS_CLIENT } from './media.tokens';
import { UserQuota } from './entities/user-quota.entity';
import { MetricsService } from '../metrics/metrics.service';

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
		sharedWith: null,
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
	updateSharedWith: jest.fn(),
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

const mockGroupService = {
	isAdmin: jest.fn().mockResolvedValue(true),
};

const mockCache = {
	get: jest.fn().mockResolvedValue(null),
	set: jest.fn().mockResolvedValue(undefined),
	del: jest.fn().mockResolvedValue(undefined),
};

const mockAccessLogRepo = {
	create: jest.fn().mockImplementation((data: any) => data),
	save: jest.fn().mockResolvedValue(undefined),
};

const mockRedisClient = {
	incr: jest.fn().mockResolvedValue(1),
	decr: jest.fn().mockResolvedValue(0),
	expire: jest.fn().mockResolvedValue(1),
	del: jest.fn().mockResolvedValue(1),
	publish: jest.fn().mockResolvedValue(1),
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

const mockUserQuotaRepo = {
	findOne: jest.fn(),
};

const mockMediaRepo = {
	findAndCount: jest.fn(),
};

const mockEntityManager = {
	getRepository: (entity: any) => {
		if (entity === UserQuota) return mockUserQuotaRepo;
		if (entity === Media) return mockMediaRepo;
		return {};
	},
};

const mockDataSource = {
	transaction: jest.fn((cb: (manager: any) => any) => cb(mockEntityManager)),
};

const mockMetricsService = {
	uploadsTotal: { inc: jest.fn() },
	downloadsTotal: { inc: jest.fn() },
	deletesTotal: { inc: jest.fn() },
};

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
				{ provide: GroupService, useValue: mockGroupService },
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: getDataSourceToken(), useValue: mockDataSource },
				{ provide: CACHE_MANAGER, useValue: mockCache },
				{ provide: getRepositoryToken(UserQuota), useValue: mockUserQuotaRepo },
				{ provide: getRepositoryToken(Media), useValue: mockMediaRepo },
				{ provide: getRepositoryToken(MediaAccessLog), useValue: mockAccessLogRepo },
				{ provide: REDIS_CLIENT, useValue: mockRedisClient },
				{ provide: MetricsService, useValue: mockMetricsService },
				{ provide: DataSource, useValue: mockDataSource },
			],
		}).compile();

		service = module.get<MediaService>(MediaService);
	});

	it('wraps RLS-sensitive repository reads and writes in explicit transactions', async () => {
		const media = makeMedia({ thumbnailPath: 'thumbnails/user-uuid-1/media-uuid-1.bin' });
		const file: Express.Multer.File = {
			originalname: 'photo.jpg',
			mimetype: 'image/jpeg',
			size: 1024,
			buffer: jpegBuffer,
		} as unknown as Express.Multer.File;

		mockMediaRepository.save.mockResolvedValue(media);
		mockMediaRepository.findById.mockResolvedValue(media);
		mockMediaRepository.updateSignedUrlExpiry.mockResolvedValue(undefined);
		mockMediaRepository.softDelete.mockResolvedValue(undefined);

		await service.upload('user-uuid-1', file, MediaContext.MESSAGE);
		await service.getMetadata('media-uuid-1', 'user-uuid-1');
		await service.getBlob('media-uuid-1', 'user-uuid-1');
		await service.getThumbnail('media-uuid-1', 'user-uuid-1');
		await service.delete('media-uuid-1', 'user-uuid-1');

		expect(mockDataSource.transaction).toHaveBeenCalledTimes(5);
		expect(mockMediaRepository.save).toHaveBeenCalledWith(expect.any(Media), mockEntityManager);
		expect(mockMediaRepository.findById).toHaveBeenCalledWith('media-uuid-1', mockEntityManager);
		expect(mockMediaRepository.updateSignedUrlExpiry).toHaveBeenCalledWith(
			'media-uuid-1',
			expect.any(Date),
			mockEntityManager
		);
		expect(mockMediaRepository.softDelete).toHaveBeenCalledWith('media-uuid-1', mockEntityManager);
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
			expect(result).toHaveProperty('media_id');
			expect(result).toHaveProperty('url');
			expect(result).toHaveProperty('thumbnail_url');
			expect(result).toHaveProperty('expires_at');
		});

		it('refreshes semaphore TTL while an upload is in progress', async () => {
			jest.useFakeTimers();

			try {
				const media = makeMedia();
				mockMediaRepository.save.mockResolvedValue(media);

				let resolveUpload: (() => void) | undefined;
				mockStorageService.upload.mockImplementationOnce(
					() =>
						new Promise<void>((resolve) => {
							resolveUpload = resolve;
						})
				);

				const uploadPromise = service.upload('user-uuid-1', file, MediaContext.MESSAGE);
				await Promise.resolve();

				expect(mockRedisClient.expire).toHaveBeenCalledTimes(1);

				await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

				expect(mockRedisClient.expire).toHaveBeenCalledTimes(2);

				resolveUpload?.();
				await uploadPromise;
			} finally {
				jest.useRealTimers();
			}
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

			expect(result.media_id).toBe('existing-media-id');
			expect(mockStorageService.upload).not.toHaveBeenCalled();
		});

		it('throws PayloadTooLargeException when quota is exceeded', async () => {
			// semaphore is fine (INCR returns 1), but quota check fails
			mockQuotaService.enforceQuota.mockRejectedValueOnce(
				new PayloadTooLargeException('quota exceeded')
			);

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

			expect(mockMediaRepository.softDelete).toHaveBeenCalledWith('media-uuid-1', mockEntityManager);
			expect(mockCache.del).toHaveBeenCalledWith('media:meta:media-uuid-1');
			expect(mockQuotaService.recordDelete).toHaveBeenCalledWith('user-uuid-1', 1024);
		});

		describe('media.deleted event (WHISPR-372)', () => {
			beforeEach(() => {
				mockRedisClient.publish.mockClear();
			});

			it('publishes media.deleted event with mediaId, ownerId and context on successful delete', async () => {
				const media = makeMedia();
				mockMediaRepository.findById.mockResolvedValue(media);

				await service.delete('media-uuid-1', 'user-uuid-1');

				// publish is fire-and-forget — wait for microtasks to flush
				await Promise.resolve();

				expect(mockRedisClient.publish).toHaveBeenCalledWith(
					'media.deleted',
					JSON.stringify({
						mediaId: 'media-uuid-1',
						ownerId: 'user-uuid-1',
						context: MediaContext.MESSAGE,
					})
				);
			});

			it('does not publish media.deleted when media is not found', async () => {
				mockMediaRepository.findById.mockResolvedValue(null);

				await expect(service.delete('missing', 'user-uuid-1')).rejects.toThrow(NotFoundException);

				await Promise.resolve();
				expect(mockRedisClient.publish).not.toHaveBeenCalled();
			});

			it('does not publish media.deleted when requester is not the owner', async () => {
				const media = makeMedia({ ownerId: 'owner-1' });
				mockMediaRepository.findById.mockResolvedValue(media);

				await expect(service.delete('media-uuid-1', 'other-user')).rejects.toThrow(
					ForbiddenException
				);

				await Promise.resolve();
				expect(mockRedisClient.publish).not.toHaveBeenCalled();
			});

			it('does not throw when publish fails (fire-and-forget)', async () => {
				const media = makeMedia();
				mockMediaRepository.findById.mockResolvedValue(media);
				mockRedisClient.publish.mockRejectedValueOnce(new Error('Redis connection lost'));

				await expect(service.delete('media-uuid-1', 'user-uuid-1')).resolves.toBeUndefined();
			});
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

	describe('getBlob()', () => {
		it('returns signed URL for message media owner', async () => {
			const media = makeMedia();
			mockMediaRepository.findById.mockResolvedValue(media);
			mockMediaRepository.updateSignedUrlExpiry.mockResolvedValue(undefined);

			const result = await service.getBlob('media-uuid-1', 'user-uuid-1');

			expect(result.url).toBe('https://presigned.url/file');
		});

		it('throws ForbiddenException for non-owner on message media', async () => {
			const media = makeMedia({ ownerId: 'owner-1' });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getBlob('media-uuid-1', 'other-user')).rejects.toThrow(ForbiddenException);
		});

		it('allows a user listed in sharedWith to download message media', async () => {
			const media = makeMedia({ ownerId: 'owner-1', sharedWith: ['friend-1', 'friend-2'] });
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getBlob('media-uuid-1', 'friend-1');

			expect(result.url).toBe('https://presigned.url/file');
		});

		it('denies a user not in sharedWith', async () => {
			const media = makeMedia({ ownerId: 'owner-1', sharedWith: ['friend-1'] });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getBlob('media-uuid-1', 'stranger')).rejects.toThrow(ForbiddenException);
		});

		it('allows any user to download avatar blob (public context)', async () => {
			const media = makeMedia({ ownerId: 'owner-1', context: MediaContext.AVATAR });
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getBlob('media-uuid-1', 'different-user');
			expect(result.url).toBe(`http://minio:9000/test-bucket/${media.storagePath}`);
			expect(mockStorageService.getPublicUrl).toHaveBeenCalledWith(media.storagePath);
		});

		it('allows any user to download group_icon blob (public context)', async () => {
			const media = makeMedia({ ownerId: 'owner-1', context: MediaContext.GROUP_ICON });
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getBlob('media-uuid-1', 'different-user');
			expect(result.url).toBe(`http://minio:9000/test-bucket/${media.storagePath}`);
			expect(mockStorageService.getPublicUrl).toHaveBeenCalledWith(media.storagePath);
		});
	});

	describe('getThumbnail()', () => {
		it('returns {url: null} when no thumbnail exists (instead of 404)', async () => {
			const media = makeMedia({ thumbnailPath: null });
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getThumbnail('media-uuid-1', 'user-uuid-1');

			expect(result).toEqual({ url: null, expiresAt: null });
		});

		it('returns signed URL when thumbnail exists', async () => {
			const media = makeMedia({ thumbnailPath: 'thumbnails/user-uuid-1/media-uuid-1.bin' });
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getThumbnail('media-uuid-1', 'user-uuid-1');

			expect(result.url).toBe('https://presigned.url/file');
		});

		it('throws ForbiddenException for non-owner on message media', async () => {
			const media = makeMedia({ ownerId: 'owner-1', context: MediaContext.MESSAGE });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.getThumbnail('media-uuid-1', 'other-user')).rejects.toThrow(
				ForbiddenException
			);
		});

		it('returns public URL for avatar thumbnail (no expiry)', async () => {
			const media = makeMedia({
				ownerId: 'owner-1',
				context: MediaContext.AVATAR,
				thumbnailPath: 'avatars/owner-1/media-uuid-1_thumb.bin',
			});
			mockMediaRepository.findById.mockResolvedValue(media);

			const result = await service.getThumbnail('media-uuid-1', 'any-user');

			expect(result.url).toBe(`http://minio:9000/test-bucket/${media.thumbnailPath}`);
			expect(result.expiresAt).toBeNull();
			expect(mockStorageService.getPublicUrl).toHaveBeenCalledWith(media.thumbnailPath);
		});

		it('throws NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.getThumbnail('missing', 'user-uuid-1')).rejects.toThrow(NotFoundException);
		});
	});

	describe('share()', () => {
		it('adds userIds to sharedWith and returns the merged list', async () => {
			const media = makeMedia({ ownerId: 'user-uuid-1', sharedWith: ['existing-uid'] });
			mockMediaRepository.findById.mockResolvedValue(media);
			mockMediaRepository.updateSharedWith.mockResolvedValue(undefined);

			const result = await service.share('media-uuid-1', 'user-uuid-1', ['new-uid']);

			expect(mockMediaRepository.updateSharedWith).toHaveBeenCalledWith(
				'media-uuid-1',
				expect.arrayContaining(['existing-uid', 'new-uid']),
				mockEntityManager
			);
			expect(result).toEqual(expect.arrayContaining(['existing-uid', 'new-uid']));
		});

		it('deduplicates userIds in sharedWith', async () => {
			const media = makeMedia({ ownerId: 'user-uuid-1', sharedWith: ['uid-1'] });
			mockMediaRepository.findById.mockResolvedValue(media);
			mockMediaRepository.updateSharedWith.mockResolvedValue(undefined);

			const result = await service.share('media-uuid-1', 'user-uuid-1', ['uid-1', 'uid-2']);

			expect(result).toEqual(expect.arrayContaining(['uid-1', 'uid-2']));
			expect(result).toHaveLength(2);
		});

		it('does not add the owner to sharedWith', async () => {
			const media = makeMedia({ ownerId: 'user-uuid-1', sharedWith: null });
			mockMediaRepository.findById.mockResolvedValue(media);
			mockMediaRepository.updateSharedWith.mockResolvedValue(undefined);

			const result = await service.share('media-uuid-1', 'user-uuid-1', ['user-uuid-1', 'uid-2']);

			expect(result).not.toContain('user-uuid-1');
			expect(result).toContain('uid-2');
		});

		it('throws NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.share('missing', 'user-uuid-1', ['uid-1'])).rejects.toThrow(
				NotFoundException
			);
		});

		it('throws ForbiddenException when non-owner tries to share', async () => {
			const media = makeMedia({ ownerId: 'owner-1' });
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.share('media-uuid-1', 'other-user', ['uid-1'])).rejects.toThrow(
				ForbiddenException
			);
		});

		it('invalidates the metadata cache after updating ACL', async () => {
			const media = makeMedia({ ownerId: 'user-uuid-1', sharedWith: null });
			mockMediaRepository.findById.mockResolvedValue(media);
			mockMediaRepository.updateSharedWith.mockResolvedValue(undefined);

			await service.share('media-uuid-1', 'user-uuid-1', ['uid-1']);

			expect(mockCache.del).toHaveBeenCalledWith('media:meta:media-uuid-1');
		});
	});

	describe('upload() with sharedWith', () => {
		const file: Express.Multer.File = {
			originalname: 'photo.jpg',
			mimetype: 'image/jpeg',
			size: 1024,
			buffer: jpegBuffer,
		} as unknown as Express.Multer.File;

		it('sets sharedWith on new upload, excluding the uploader', async () => {
			mockMediaRepository.save.mockResolvedValue(undefined);

			await service.upload('user-uuid-1', file, MediaContext.MESSAGE, undefined, [
				'user-uuid-1',
				'friend-1',
				'friend-2',
			]);

			const savedMedia: Media = mockMediaRepository.save.mock.calls[0][0];
			expect(savedMedia.sharedWith).not.toContain('user-uuid-1');
			expect(savedMedia.sharedWith).toEqual(expect.arrayContaining(['friend-1', 'friend-2']));
		});

		it('merges sharedWith ACL on dedup hit', async () => {
			mockCache.get.mockResolvedValueOnce('existing-media-id');
			const existingMedia = makeMedia({ id: 'existing-media-id', sharedWith: ['uid-a'] });
			mockMediaRepository.findById.mockResolvedValue(existingMedia);
			mockMediaRepository.updateSharedWith.mockResolvedValue(undefined);

			await service.upload('user-uuid-1', file, MediaContext.MESSAGE, undefined, ['uid-b']);

			expect(mockMediaRepository.updateSharedWith).toHaveBeenCalledWith(
				'existing-media-id',
				expect.arrayContaining(['uid-a', 'uid-b']),
				mockEntityManager
			);
		});

		it('skips ACL update on dedup hit when sharedWith is empty', async () => {
			mockCache.get.mockResolvedValueOnce('existing-media-id');
			const existingMedia = makeMedia({ id: 'existing-media-id', sharedWith: ['uid-a'] });
			mockMediaRepository.findById.mockResolvedValue(existingMedia);

			await service.upload('user-uuid-1', file, MediaContext.MESSAGE);

			expect(mockMediaRepository.updateSharedWith).not.toHaveBeenCalled();
		});
	});

	describe('upload() — GROUP_ICON authorization (WHISPR-932)', () => {
		const file: Express.Multer.File = {
			originalname: 'icon.jpg',
			mimetype: 'image/jpeg',
			size: 1024,
			buffer: jpegBuffer,
		} as unknown as Express.Multer.File;

		it('lets the upload through when isAdmin returns true', async () => {
			mockGroupService.isAdmin.mockResolvedValueOnce(true);
			mockMediaRepository.save.mockResolvedValue(undefined);

			const result = await service.upload('owner-1', file, MediaContext.GROUP_ICON);

			expect(mockGroupService.isAdmin).toHaveBeenCalledWith('owner-1');
			expect(mockStorageService.upload).toHaveBeenCalled();
			expect(mockMediaRepository.save).toHaveBeenCalled();
			expect(result.context).toBe(MediaContext.GROUP_ICON);
		});

		it('returns 403 when isAdmin returns false (non-admin or non-member)', async () => {
			mockGroupService.isAdmin.mockResolvedValueOnce(false);

			await expect(service.upload('owner-1', file, MediaContext.GROUP_ICON)).rejects.toThrow(
				ForbiddenException
			);

			expect(mockStorageService.upload).not.toHaveBeenCalled();
			expect(mockMediaRepository.save).not.toHaveBeenCalled();
		});

		it('returns 503 when group-service is unavailable (isAdmin throws)', async () => {
			mockGroupService.isAdmin.mockRejectedValueOnce(new Error('ECONNREFUSED'));

			await expect(service.upload('owner-1', file, MediaContext.GROUP_ICON)).rejects.toThrow(
				ServiceUnavailableException
			);

			expect(mockStorageService.upload).not.toHaveBeenCalled();
		});

		it('does not call group-service for non-GROUP_ICON uploads (no regression)', async () => {
			mockMediaRepository.save.mockResolvedValue(undefined);

			await service.upload('user-uuid-1', file, MediaContext.MESSAGE);
			await service.upload('user-uuid-1', file, MediaContext.AVATAR);

			expect(mockGroupService.isAdmin).not.toHaveBeenCalled();
		});
	});

	describe('getUserQuota', () => {
		it('should return existing user quota with calculated usagePercent', async () => {
			const quota = new UserQuota();
			quota.storageUsed = BigInt(536870912);
			quota.storageLimit = BigInt(1073741824);
			quota.filesCount = 50;
			quota.filesLimit = 1000;
			quota.dailyUploads = 5;
			quota.dailyUploadLimit = 100;
			quota.quotaDate = '2026-03-22';

			mockUserQuotaRepo.findOne.mockResolvedValue(quota);

			const result = await service.getUserQuota('user-uuid-1');

			expect(result.storageUsed).toBe(536870912);
			expect(result.storageLimit).toBe(1073741824);
			expect(result.usagePercent).toBe(50);
			expect(result.quotaDate).toBe('2026-03-22');
		});

		it('should return default values when no quota exists', async () => {
			mockUserQuotaRepo.findOne.mockResolvedValue(null);

			const result = await service.getUserQuota('user-uuid-1');

			expect(result.storageUsed).toBe(0);
			expect(result.storageLimit).toBe(1073741824);
			expect(result.filesCount).toBe(0);
			expect(result.filesLimit).toBe(1000);
			expect(result.dailyUploads).toBe(0);
			expect(result.dailyUploadLimit).toBe(100);
			expect(result.quotaDate).toBeNull();
			expect(result.usagePercent).toBe(0);
		});
	});

	describe('getUserMedia', () => {
		it('should return paginated media list', async () => {
			const media1 = new Media();
			media1.id = 'media-1';
			media1.contentType = 'image/jpeg';
			media1.blobSize = 1024;
			media1.context = 'messages';
			media1.createdAt = new Date();

			mockMediaRepo.findAndCount.mockResolvedValue([[media1], 1]);

			const result = await service.getUserMedia('user-uuid-1', 1, 20);

			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(1);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(20);
			expect(result.totalPages).toBe(1);
			expect(mockMediaRepo.findAndCount).toHaveBeenCalledWith({
				where: { ownerId: 'user-uuid-1', isActive: true },
				order: { createdAt: 'DESC' },
				skip: 0,
				take: 20,
			});
		});

		it('should calculate totalPages correctly', async () => {
			mockMediaRepo.findAndCount.mockResolvedValue([[], 45]);

			const result = await service.getUserMedia('user-uuid-1', 1, 20);

			expect(result.totalPages).toBe(3);
		});
	});

	describe('logAccess', () => {
		it('should create and save an access log entry', () => {
			service.logAccess('media-1', 'user-1', 'download');

			expect(mockAccessLogRepo.create).toHaveBeenCalledWith({
				mediaId: 'media-1',
				accessorId: 'user-1',
				accessType: 'download',
				accessedAt: expect.any(Date),
			});
			expect(mockAccessLogRepo.save).toHaveBeenCalled();
		});

		it('should handle null accessorId', () => {
			service.logAccess('media-1', null, 'presigned_url');

			expect(mockAccessLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ accessorId: null })
			);
		});

		it('should catch save errors without throwing', async () => {
			mockAccessLogRepo.save.mockRejectedValueOnce(new Error('DB error'));

			expect(() => service.logAccess('media-1', 'user-1', 'download')).not.toThrow();
		});
	});
});

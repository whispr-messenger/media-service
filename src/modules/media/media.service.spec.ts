import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getS3ConnectionToken } from 'nestjs-s3';
import { MediaService } from './media.service';
import { MediaRepository } from './repositories/media.repository';
import { StorageService } from './storage.service';
import { Media } from './entities/media.entity';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
	getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/file'),
}));

const mockMediaRepository = {
	save: jest.fn(),
	findById: jest.fn(),
	softDelete: jest.fn(),
};

const mockStorageService = {
	bucket: 'test-bucket',
	buildPath: jest.fn(),
	upload: jest.fn().mockResolvedValue(undefined),
	download: jest.fn(),
	delete: jest.fn().mockResolvedValue(undefined),
};

const mockS3 = {
	putObject: jest.fn().mockResolvedValue({}),
	getObject: jest.fn(),
	send: jest.fn().mockResolvedValue({}),
};

const mockConfigService = {
	get: jest.fn((key: string, defaultValue?: unknown) => {
		const config: Record<string, unknown> = {
			PRESIGNED_URL_TTL_SECONDS: 3600,
		};
		return config[key] ?? defaultValue;
	}),
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
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<MediaService>(MediaService);
	});

	describe('upload', () => {
		it('should upload file via StorageService and persist a Media record', async () => {
			const ownerId = 'user-uuid-1';
			const file = {
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				size: 1024,
				buffer: Buffer.from('data'),
			} as Express.Multer.File;

			mockStorageService.buildPath.mockReturnValue('messages/user-uuid-1/media-uuid-1.bin');

			const saved = new Media();
			saved.id = 'media-uuid-1';
			saved.ownerId = ownerId;
			saved.context = 'messages';
			saved.contentType = file.mimetype;
			saved.blobSize = file.size;
			saved.storagePath = 'messages/user-uuid-1/media-uuid-1.bin';
			saved.thumbnailPath = null;
			saved.expiresAt = null;
			saved.isActive = true;
			saved.createdAt = new Date();
			saved.updatedAt = new Date();

			mockMediaRepository.save.mockResolvedValue(saved);

			const result = await service.upload(ownerId, file, 'messages');

			expect(mockStorageService.buildPath).toHaveBeenCalledWith(
				'messages',
				ownerId,
				expect.any(String)
			);
			expect(mockStorageService.upload).toHaveBeenCalledWith(
				'messages/user-uuid-1/media-uuid-1.bin',
				expect.any(Object),
				'image/jpeg',
				1024
			);
			expect(mockMediaRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					ownerId,
					context: 'messages',
					contentType: 'image/jpeg',
					blobSize: 1024,
					storagePath: 'messages/user-uuid-1/media-uuid-1.bin',
				})
			);
			expect(result).toBe(saved);
		});

		it('should default to messages context for unknown context values', async () => {
			const ownerId = 'user-uuid-1';
			const file = {
				originalname: 'file.bin',
				mimetype: 'application/octet-stream',
				size: 512,
				buffer: Buffer.from('data'),
			} as Express.Multer.File;

			mockStorageService.buildPath.mockReturnValue('messages/user-uuid-1/some-id.bin');
			mockMediaRepository.save.mockResolvedValue(new Media());

			await service.upload(ownerId, file, 'unknown');

			expect(mockStorageService.buildPath).toHaveBeenCalledWith(
				'messages',
				ownerId,
				expect.any(String)
			);
		});
	});

	describe('getDownloadUrl', () => {
		it('should return a presigned URL for an existing media', async () => {
			const media = new Media();
			media.id = 'media-uuid-1';
			media.storagePath = 'messages/user-1/media-uuid-1.bin';
			mockMediaRepository.findById.mockResolvedValue(media);

			const url = await service.getDownloadUrl('media-uuid-1');

			expect(url).toBe('https://presigned.url/file');
			expect(mockMediaRepository.findById).toHaveBeenCalledWith('media-uuid-1');
		});

		it('should throw NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.getDownloadUrl('missing-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('getStream', () => {
		it('should return stream and contentType for an existing media', async () => {
			const media = new Media();
			media.id = 'media-uuid-1';
			media.storagePath = 'messages/user-1/media-uuid-1.bin';
			media.contentType = 'image/jpeg';
			mockMediaRepository.findById.mockResolvedValue(media);

			const fakeStream = {};
			mockStorageService.download.mockResolvedValue(fakeStream);

			const result = await service.getStream('media-uuid-1');

			expect(mockMediaRepository.findById).toHaveBeenCalledWith('media-uuid-1');
			expect(mockStorageService.download).toHaveBeenCalledWith('messages/user-1/media-uuid-1.bin');
			expect(result.contentType).toBe('image/jpeg');
			expect(result.stream).toBe(fakeStream);
		});

		it('should throw NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.getStream('missing-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('delete', () => {
		it('should delete from StorageService and soft-delete when requester is owner', async () => {
			const media = new Media();
			media.id = 'media-uuid-1';
			media.ownerId = 'user-1';
			media.storagePath = 'messages/user-1/media-uuid-1.bin';
			mockMediaRepository.findById.mockResolvedValue(media);

			await service.delete('media-uuid-1', 'user-1');

			expect(mockStorageService.delete).toHaveBeenCalledWith('messages/user-1/media-uuid-1.bin');
			expect(mockMediaRepository.softDelete).toHaveBeenCalledWith('media-uuid-1');
		});

		it('should throw NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.delete('missing-id', 'user-1')).rejects.toThrow(NotFoundException);
		});

		it('should throw NotFoundException when requester is not the owner', async () => {
			const media = new Media();
			media.id = 'media-uuid-1';
			media.ownerId = 'user-1';
			mockMediaRepository.findById.mockResolvedValue(media);

			await expect(service.delete('media-uuid-1', 'user-2')).rejects.toThrow(NotFoundException);
		});
	});
});

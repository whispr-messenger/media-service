import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getS3ConnectionToken } from 'nestjs-s3';
import { MediaService } from './media.service';

import { MediaRepository } from './repositories/media.repository';
import { Media } from './entities/media.entity';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
	getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/file'),
}));

const mockMediaRepository = {
	save: jest.fn(),
	findById: jest.fn(),
	softDelete: jest.fn(),
};

const mockS3 = {
	putObject: jest.fn().mockResolvedValue({}),
	getObject: jest.fn(),
	send: jest.fn().mockResolvedValue({}),
	listBuckets: jest.fn().mockResolvedValue({}),
};

const mockConfigService = {
	get: jest.fn((key: string, defaultValue?: unknown) => {
		const config: Record<string, unknown> = {
			S3_BUCKET: 'test-bucket',
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
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<MediaService>(MediaService);
	});

	describe('upload', () => {
		it('should upload file and persist a Media record', async () => {
			const ownerId = 'user-uuid-1';
			const file = {
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				size: 1024,
				buffer: Buffer.from('data'),
			} as Express.Multer.File;

			const saved = new Media();
			saved.id = 'media-uuid-1';
			saved.ownerId = ownerId;
			saved.context = 'default';
			saved.contentType = file.mimetype;
			saved.blobSize = file.size;
			saved.storagePath = `${ownerId}/media-uuid-1.jpg`;
			saved.thumbnailPath = null;
			saved.expiresAt = null;
			saved.isActive = true;
			saved.createdAt = new Date();
			saved.updatedAt = new Date();

			mockMediaRepository.save.mockResolvedValue(saved);

			const result = await service.upload(ownerId, file, 'default');

			expect(mockS3.putObject).toHaveBeenCalledWith(
				expect.objectContaining({
					Bucket: 'test-bucket',
					ContentType: 'image/jpeg',
					Body: file.buffer,
				})
			);
			expect(mockMediaRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					ownerId,
					context: 'default',
					contentType: 'image/jpeg',
					blobSize: 1024,
				})
			);
			expect(result).toBe(saved);
		});
	});

	describe('getDownloadUrl', () => {
		it('should return a presigned URL for an existing media', async () => {
			const media = new Media();
			media.id = 'media-uuid-1';
			media.storagePath = 'user-1/media-uuid-1.jpg';
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
			media.storagePath = 'user-1/media-uuid-1.jpg';
			media.contentType = 'image/jpeg';
			mockMediaRepository.findById.mockResolvedValue(media);

			const fakeStream = {};
			mockS3.getObject.mockResolvedValue({ Body: fakeStream });

			const result = await service.getStream('media-uuid-1');

			expect(mockMediaRepository.findById).toHaveBeenCalledWith('media-uuid-1');
			expect(mockS3.getObject).toHaveBeenCalledWith(
				expect.objectContaining({ Bucket: 'test-bucket', Key: media.storagePath })
			);
			expect(result.contentType).toBe('image/jpeg');
			expect(result.stream).toBe(fakeStream);
		});

		it('should throw NotFoundException when media does not exist', async () => {
			mockMediaRepository.findById.mockResolvedValue(null);

			await expect(service.getStream('missing-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('delete', () => {
		it('should soft-delete and remove from S3 when requester is owner', async () => {
			const media = new Media();
			media.id = 'media-uuid-1';
			media.ownerId = 'user-1';
			media.storagePath = 'user-1/media-uuid-1.jpg';
			mockMediaRepository.findById.mockResolvedValue(media);

			await service.delete('media-uuid-1', 'user-1');

			expect(mockS3.send).toHaveBeenCalled();
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

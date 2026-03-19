import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getS3ConnectionToken } from 'nestjs-s3';
import { MediaService } from './media.service';

import { MediaFileRepository } from './repositories/media-file.repository';
import { MediaFile, MediaFileStatus } from './entities/media-file.entity';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
	getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/file'),
}));

const mockMediaFileRepository = {
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
				{ provide: MediaFileRepository, useValue: mockMediaFileRepository },
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<MediaService>(MediaService);
	});

	describe('upload', () => {
		it('should upload file and persist a MediaFile record', async () => {
			const uploaderId = 'user-uuid-1';
			const file = {
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				size: 1024,
				buffer: Buffer.from('data'),
			} as Express.Multer.File;

			const saved = new MediaFile();
			saved.id = 'file-uuid-1';
			saved.uploaderId = uploaderId;
			saved.filename = file.originalname;
			saved.mimeType = file.mimetype;
			saved.size = file.size;
			saved.storageKey = `${uploaderId}/file-uuid-1.jpg`;
			saved.status = MediaFileStatus.ACTIVE;
			saved.createdAt = new Date();

			mockMediaFileRepository.save.mockResolvedValue(saved);

			const result = await service.upload(uploaderId, file);

			expect(mockS3.putObject).toHaveBeenCalledWith(
				expect.objectContaining({
					Bucket: 'test-bucket',
					ContentType: 'image/jpeg',
					Body: file.buffer,
				})
			);
			expect(mockMediaFileRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					uploaderId,
					filename: 'photo.jpg',
					mimeType: 'image/jpeg',
					size: 1024,
				})
			);
			expect(result).toBe(saved);
		});
	});

	describe('getDownloadUrl', () => {
		it('should return a presigned URL for an existing file', async () => {
			const mediaFile = new MediaFile();
			mediaFile.id = 'file-uuid-1';
			mediaFile.storageKey = 'user-1/file-uuid-1.jpg';
			mockMediaFileRepository.findById.mockResolvedValue(mediaFile);

			const url = await service.getDownloadUrl('file-uuid-1');

			expect(url).toBe('https://presigned.url/file');
			expect(mockMediaFileRepository.findById).toHaveBeenCalledWith('file-uuid-1');
		});

		it('should throw NotFoundException when file does not exist', async () => {
			mockMediaFileRepository.findById.mockResolvedValue(null);

			await expect(service.getDownloadUrl('missing-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('delete', () => {
		it('should soft-delete and remove from S3 when requester is uploader', async () => {
			const mediaFile = new MediaFile();
			mediaFile.id = 'file-uuid-1';
			mediaFile.uploaderId = 'user-1';
			mediaFile.storageKey = 'user-1/file-uuid-1.jpg';
			mockMediaFileRepository.findById.mockResolvedValue(mediaFile);

			await service.delete('file-uuid-1', 'user-1');

			expect(mockS3.send).toHaveBeenCalled();
			expect(mockMediaFileRepository.softDelete).toHaveBeenCalledWith('file-uuid-1');
		});

		it('should throw NotFoundException when file does not exist', async () => {
			mockMediaFileRepository.findById.mockResolvedValue(null);

			await expect(service.delete('missing-id', 'user-1')).rejects.toThrow(NotFoundException);
		});

		it('should throw NotFoundException when requester is not the uploader', async () => {
			const mediaFile = new MediaFile();
			mediaFile.id = 'file-uuid-1';
			mediaFile.uploaderId = 'user-1';
			mockMediaFileRepository.findById.mockResolvedValue(mediaFile);

			await expect(service.delete('file-uuid-1', 'user-2')).rejects.toThrow(NotFoundException);
		});
	});
});

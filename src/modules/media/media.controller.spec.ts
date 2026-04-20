import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaContext, UploadMediaDto } from './dto/upload-media.dto';
import type { Request } from 'express';

const makeReq = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

const mockMediaService = {
	upload: jest.fn(),
	getMetadata: jest.fn(),
	getBlob: jest.fn(),
	getThumbnail: jest.fn(),
	share: jest.fn(),
	delete: jest.fn(),
	getStream: jest.fn(),
	getUserQuota: jest.fn(),
	getUserMedia: jest.fn(),
	logAccess: jest.fn(),
};

describe('MediaController', () => {
	let controller: MediaController;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [MediaController],
			providers: [{ provide: MediaService, useValue: mockMediaService }],
		}).compile();

		controller = module.get<MediaController>(MediaController);
	});

	describe('upload()', () => {
		const dto: UploadMediaDto = { context: MediaContext.MESSAGE, ownerId: 'user-uuid-1' };
		const file = {
			originalname: 'photo.jpg',
			mimetype: 'image/jpeg',
			size: 2048,
			buffer: Buffer.from('data'),
		} as Express.Multer.File;

		it('should return UploadMediaResponseDto on success', async () => {
			const expected = {
				media_id: 'media-uuid-1',
				url: 'http://minio/messages/photo.jpg',
				thumbnail_url: null,
				expires_at: null,
				context: MediaContext.MESSAGE,
				size: 2048,
			};
			mockMediaService.upload.mockResolvedValue(expected);

			const result = await controller.upload(
				makeReq('user-uuid-1'),
				{ file: [file], thumbnail: [] },
				dto
			);

			expect(result).toEqual(expected);
		});

		it('throws BadRequestException when no file is provided', async () => {
			await expect(
				controller.upload(makeReq('user-uuid-1'), { file: [], thumbnail: [] }, dto)
			).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException when authenticated user is missing', async () => {
			const req = { user: {} } as unknown as Request;
			await expect(controller.upload(req, { file: [file], thumbnail: [] }, dto)).rejects.toThrow(
				BadRequestException
			);
		});

		it('throws BadRequestException when ownerId does not match authenticated user', async () => {
			const mismatchDto: UploadMediaDto = { context: MediaContext.MESSAGE, ownerId: 'other-user' };
			await expect(
				controller.upload(makeReq('user-uuid-1'), { file: [file] }, mismatchDto)
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('getMetadata()', () => {
		it('throws BadRequestException when authenticated user is missing', async () => {
			const req = { user: {} } as unknown as Request;
			await expect(controller.getMetadata('media-id', req)).rejects.toThrow(BadRequestException);
		});

		it('returns metadata on success', async () => {
			const meta = { id: 'media-id', ownerId: 'user-uuid-1' };
			mockMediaService.getMetadata.mockResolvedValue(meta);

			const result = await controller.getMetadata('media-id', makeReq('user-uuid-1'));

			expect(result).toEqual(meta);
		});
	});

	describe('getBlobUrl()', () => {
		it('returns {url, expiresAt} JSON', async () => {
			const expiresAt = new Date('2030-01-01T00:00:00Z');
			mockMediaService.getBlob.mockResolvedValue({ url: 'https://blob.url', expiresAt });
			const req = { user: { userId: 'user-uuid-1' }, headers: {}, socket: {} } as unknown as Request;

			const result = await controller.getBlobUrl('media-id', req);

			expect(result).toEqual({ url: 'https://blob.url', expiresAt });
			expect(mockMediaService.getBlob).toHaveBeenCalledWith(
				'media-id',
				'user-uuid-1',
				undefined,
				undefined
			);
		});

		it('throws BadRequestException when authenticated user is missing', async () => {
			const req = { user: {}, headers: {}, socket: {} } as unknown as Request;

			await expect(controller.getBlobUrl('media-id', req)).rejects.toThrow(BadRequestException);
		});
	});

	describe('getThumbnailUrl()', () => {
		it('returns {url, expiresAt} JSON', async () => {
			const expiresAt = new Date('2030-01-01T00:00:00Z');
			mockMediaService.getThumbnail.mockResolvedValue({ url: 'https://thumb.url', expiresAt });
			const req = { user: { userId: 'user-uuid-1' }, headers: {}, socket: {} } as unknown as Request;

			const result = await controller.getThumbnailUrl('media-id', req);

			expect(result).toEqual({ url: 'https://thumb.url', expiresAt });
		});

		it('returns {url: null} when no thumbnail exists', async () => {
			mockMediaService.getThumbnail.mockResolvedValue({ url: null, expiresAt: null });
			const req = { user: { userId: 'user-uuid-1' }, headers: {}, socket: {} } as unknown as Request;

			const result = await controller.getThumbnailUrl('media-id', req);

			expect(result).toEqual({ url: null, expiresAt: null });
		});
	});

	describe('share()', () => {
		it('delegates to service and returns updated sharedWith', async () => {
			mockMediaService.share.mockResolvedValue(['uuid-a', 'uuid-b']);
			const result = await controller.share('media-id', makeReq('owner-uuid'), {
				userIds: ['uuid-a', 'uuid-b'],
			});
			expect(mockMediaService.share).toHaveBeenCalledWith('media-id', 'owner-uuid', [
				'uuid-a',
				'uuid-b',
			]);
			expect(result).toEqual({ sharedWith: ['uuid-a', 'uuid-b'] });
		});

		it('throws BadRequestException when user missing', async () => {
			const req = { user: {} } as unknown as Request;
			await expect(controller.share('media-id', req, { userIds: [] })).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('getQuota()', () => {
		it('should return user quota', async () => {
			const quota = {
				storageUsed: 100,
				storageLimit: 1073741824,
				filesCount: 1,
				filesLimit: 1000,
				dailyUploads: 1,
				dailyUploadLimit: 100,
				quotaDate: '2026-03-22',
				usagePercent: 0,
			};
			mockMediaService.getUserQuota.mockResolvedValue(quota);

			const result = await controller.getQuota(makeReq('user-uuid-1'));

			expect(result).toEqual(quota);
			expect(mockMediaService.getUserQuota).toHaveBeenCalledWith('user-uuid-1');
		});
	});

	describe('getMyMedia()', () => {
		it('should return paginated media list with default params', async () => {
			const response = {
				items: [],
				total: 0,
				page: 1,
				limit: 20,
				totalPages: 0,
			};
			mockMediaService.getUserMedia.mockResolvedValue(response);

			const result = await controller.getMyMedia(makeReq('user-uuid-1'));

			expect(result).toEqual(response);
			expect(mockMediaService.getUserMedia).toHaveBeenCalledWith('user-uuid-1', 1, 20);
		});

		it('should parse page and limit params', async () => {
			mockMediaService.getUserMedia.mockResolvedValue({
				items: [],
				total: 0,
				page: 2,
				limit: 50,
				totalPages: 0,
			});

			await controller.getMyMedia(makeReq('user-uuid-1'), '2', '50');

			expect(mockMediaService.getUserMedia).toHaveBeenCalledWith('user-uuid-1', 2, 50);
		});

		it('should cap limit at 100', async () => {
			mockMediaService.getUserMedia.mockResolvedValue({
				items: [],
				total: 0,
				page: 1,
				limit: 100,
				totalPages: 0,
			});

			await controller.getMyMedia(makeReq('user-uuid-1'), '1', '200');

			expect(mockMediaService.getUserMedia).toHaveBeenCalledWith('user-uuid-1', 1, 100);
		});
	});

	describe('delete()', () => {
		it('throws BadRequestException when authenticated user is missing', async () => {
			const req = { user: {}, headers: {}, socket: {} } as unknown as Request;
			await expect(controller.delete('media-id', req)).rejects.toThrow(BadRequestException);
		});

		it('calls mediaService.delete and returns void', async () => {
			mockMediaService.delete.mockResolvedValue(undefined);
			const req = { user: { userId: 'user-uuid-1' }, headers: {}, socket: {} } as unknown as Request;

			const result = await controller.delete('media-id', req);

			expect(mockMediaService.delete).toHaveBeenCalledWith(
				'media-id',
				'user-uuid-1',
				undefined,
				undefined
			);
			expect(result).toBeUndefined();
		});
	});
});

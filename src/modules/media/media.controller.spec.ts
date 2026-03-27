import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaContext, UploadMediaDto } from './dto/upload-media.dto';
import type { Request, Response } from 'express';

const mockMediaService = {
	upload: jest.fn(),
	getMetadata: jest.fn(),
	getBlobUrl: jest.fn(),
	getThumbnailUrl: jest.fn(),
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
				mediaId: 'media-uuid-1',
				url: 'http://minio/messages/photo.jpg',
				thumbnailUrl: null,
				expiresAt: null,
				context: MediaContext.MESSAGE,
				size: 2048,
			};
			mockMediaService.upload.mockResolvedValue(expected);

			const result = await controller.upload('user-uuid-1', { file: [file], thumbnail: [] }, dto);

			expect(result).toEqual(expected);
		});

		it('throws BadRequestException when no file is provided', async () => {
			await expect(controller.upload('user-uuid-1', { file: [], thumbnail: [] }, dto)).rejects.toThrow(
				BadRequestException
			);
		});

		it('throws BadRequestException when x-user-id header is missing', async () => {
			await expect(
				controller.upload(undefined as unknown as string, { file: [file], thumbnail: [] }, dto)
			).rejects.toThrow(BadRequestException);
		});

		it('throws BadRequestException when ownerId does not match header', async () => {
			const mismatchDto: UploadMediaDto = { context: MediaContext.MESSAGE, ownerId: 'other-user' };
			await expect(controller.upload('user-uuid-1', { file: [file] }, mismatchDto)).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('getMetadata()', () => {
		it('throws BadRequestException when x-user-id is missing', async () => {
			await expect(controller.getMetadata('media-id', undefined as unknown as string)).rejects.toThrow(
				BadRequestException
			);
		});

		it('returns metadata on success', async () => {
			const meta = { id: 'media-id', ownerId: 'user-uuid-1' };
			mockMediaService.getMetadata.mockResolvedValue(meta);

			const result = await controller.getMetadata('media-id', 'user-uuid-1');

			expect(result).toEqual(meta);
		});
	});

	describe('getBlobUrl()', () => {
		it('redirects to blob URL', async () => {
			mockMediaService.getBlobUrl.mockResolvedValue('https://blob.url');
			const redirect = jest.fn();
			const res = { redirect } as unknown as Response;
			const req = { headers: {}, socket: {} } as Request;

			await controller.getBlobUrl('media-id', 'user-uuid-1', req, res);

			expect(redirect).toHaveBeenCalledWith(302, 'https://blob.url');
		});

		it('throws BadRequestException when x-user-id is missing', async () => {
			const res = { redirect: jest.fn() } as unknown as Response;
			const req = { headers: {}, socket: {} } as Request;

			await expect(
				controller.getBlobUrl('media-id', undefined as unknown as string, req, res)
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('getThumbnailUrl()', () => {
		it('redirects to thumbnail URL', async () => {
			mockMediaService.getThumbnailUrl.mockResolvedValue('https://thumb.url');
			const redirect = jest.fn();
			const res = { redirect } as unknown as Response;
			const req = { headers: {}, socket: {} } as Request;

			await controller.getThumbnailUrl('media-id', 'user-uuid-1', req, res);

			expect(redirect).toHaveBeenCalledWith(302, 'https://thumb.url');
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

	describe('download()', () => {
		it('should set correct Content-Type header and pipe stream to response', async () => {
			const stream = new Readable({ read() {} });

			mockMediaService.getStream.mockResolvedValue({
				stream,
				contentType: 'image/jpeg',
			});

			const setHeader = jest.fn();
			const pipe = jest
				.spyOn(stream, 'pipe')
				.mockImplementation(() => stream as unknown as NodeJS.WritableStream);
			const res = { setHeader, pipe } as unknown as import('express').Response;

			await controller.download('media-uuid-1', 'user-uuid-1', res);

			expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
			expect(setHeader).toHaveBeenCalledWith(
				'Content-Disposition',
				'attachment; filename="media-uuid-1"'
			);
			expect(pipe).toHaveBeenCalledWith(res);
			expect(mockMediaService.logAccess).toHaveBeenCalledWith(
				'media-uuid-1',
				'user-uuid-1',
				'download'
			);
		});
	});


	describe('delete()', () => {
		it('throws BadRequestException when x-user-id is missing', async () => {
			const req = { headers: {}, socket: {} } as Request;
			await expect(controller.delete('media-id', undefined as unknown as string, req)).rejects.toThrow(
				BadRequestException
			);
		});

		it('calls mediaService.delete and returns void', async () => {
			mockMediaService.delete.mockResolvedValue(undefined);
			const req = { headers: {}, socket: {} } as Request;

			const result = await controller.delete('media-id', 'user-uuid-1', req);

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

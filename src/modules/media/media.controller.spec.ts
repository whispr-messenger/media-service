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
	updateModerationStatus: jest.fn(),
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
			await expect(controller.upload('', { file: [file], thumbnail: [] }, dto)).rejects.toThrow(
				BadRequestException
			);
		});

		it('throws BadRequestException when ownerId does not match authenticated user', async () => {
			const mismatchDto: UploadMediaDto = { context: MediaContext.MESSAGE, ownerId: 'other-user' };
			await expect(controller.upload('user-uuid-1', { file: [file] }, mismatchDto)).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('getMetadata()', () => {
		it('throws BadRequestException when x-user-id header is missing', async () => {
			await expect(controller.getMetadata('media-id', '')).rejects.toThrow(BadRequestException);
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
			const req = { headers: {}, socket: {} } as unknown as Request;

			await controller.getBlobUrl('media-id', 'user-uuid-1', req, res);

			expect(redirect).toHaveBeenCalledWith(302, 'https://blob.url');
		});

		it('throws BadRequestException when x-user-id header is missing', async () => {
			const res = { redirect: jest.fn() } as unknown as Response;
			const req = { headers: {}, socket: {} } as unknown as Request;

			await expect(controller.getBlobUrl('media-id', '', req, res)).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('getThumbnailUrl()', () => {
		it('redirects to thumbnail URL', async () => {
			mockMediaService.getThumbnailUrl.mockResolvedValue('https://thumb.url');
			const redirect = jest.fn();
			const res = { redirect } as unknown as Response;
			const req = { headers: {}, socket: {} } as unknown as Request;

			await controller.getThumbnailUrl('media-id', 'user-uuid-1', req, res);

			expect(redirect).toHaveBeenCalledWith(302, 'https://thumb.url');
		});
	});

	describe('delete()', () => {
		it('throws BadRequestException when x-user-id header is missing', async () => {
			const req = { headers: {}, socket: {} } as unknown as Request;
			await expect(controller.delete('media-id', '', req)).rejects.toThrow(BadRequestException);
		});

		it('calls mediaService.delete and returns void', async () => {
			mockMediaService.delete.mockResolvedValue(undefined);
			const req = {
				headers: { 'x-forwarded-for': '1.2.3.4' },
				socket: {},
				get: jest.fn(),
			} as unknown as Request;

			const result = await controller.delete('media-id', 'user-uuid-1', req);

			expect(mockMediaService.delete).toHaveBeenCalledWith(
				'media-id',
				'user-uuid-1',
				'1.2.3.4',
				undefined
			);
			expect(result).toBeUndefined();
		});
	});

	describe('updateModeration()', () => {
		it('calls mediaService.updateModerationStatus with correct args', async () => {
			mockMediaService.updateModerationStatus.mockResolvedValue(undefined);

			await controller.updateModeration('media-uuid-1', {
				status: 'approved',
				score: 0.95,
				category: 'safe',
			});

			expect(mockMediaService.updateModerationStatus).toHaveBeenCalledWith(
				'media-uuid-1',
				'approved',
				0.95,
				'safe'
			);
		});

		it('handles missing optional fields', async () => {
			mockMediaService.updateModerationStatus.mockResolvedValue(undefined);

			await controller.updateModeration('media-uuid-1', { status: 'rejected' });

			expect(mockMediaService.updateModerationStatus).toHaveBeenCalledWith(
				'media-uuid-1',
				'rejected',
				undefined,
				undefined
			);
		});
	});
});

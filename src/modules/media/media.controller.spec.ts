import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

const mockMediaService = {
	upload: jest.fn(),
	getStream: jest.fn(),
	delete: jest.fn(),
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
		it('should return UploadMediaResponseDto shape when file and ownerId are provided', async () => {
			const file = {
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				size: 2048,
				buffer: Buffer.from('data'),
			} as Express.Multer.File;

			const createdAt = new Date();
			const media = {
				id: 'media-uuid-1',
				contentType: 'image/jpeg',
				blobSize: 2048,
				createdAt,
			};

			mockMediaService.upload.mockResolvedValue(media);

			const result = await controller.upload('user-uuid-1', file);

			expect(result).toEqual({
				id: 'media-uuid-1',
				contentType: 'image/jpeg',
				blobSize: 2048,
				createdAt,
			});
		});

		it('should throw BadRequestException when no file is provided', async () => {
			await expect(
				controller.upload('user-uuid-1', undefined as unknown as Express.Multer.File)
			).rejects.toThrow(new BadRequestException('No file provided'));
		});

		it('should throw BadRequestException when ownerId header is missing', async () => {
			const file = {
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				size: 512,
				buffer: Buffer.from('x'),
			} as Express.Multer.File;

			await expect(controller.upload(undefined as unknown as string, file)).rejects.toThrow(
				new BadRequestException('Missing x-user-id header')
			);
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

			await controller.download('media-uuid-1', res);

			expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
			expect(setHeader).toHaveBeenCalledWith(
				'Content-Disposition',
				'attachment; filename="media-uuid-1"'
			);
			expect(pipe).toHaveBeenCalledWith(res);
		});
	});

	describe('delete()', () => {
		it('should throw BadRequestException when requesterId header is missing', async () => {
			await expect(controller.delete('media-uuid-1', undefined as unknown as string)).rejects.toThrow(
				new BadRequestException('Missing x-user-id header')
			);
		});

		it('should call mediaService.delete and return void when requesterId is provided', async () => {
			mockMediaService.delete.mockResolvedValue(undefined);

			const result = await controller.delete('media-uuid-1', 'user-uuid-1');

			expect(mockMediaService.delete).toHaveBeenCalledWith('media-uuid-1', 'user-uuid-1');
			expect(result).toBeUndefined();
		});
	});
});

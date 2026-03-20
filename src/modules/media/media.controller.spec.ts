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
		it('should return UploadMediaResponseDto shape when file and uploaderId are provided', async () => {
			const file = {
				originalname: 'photo.jpg',
				mimetype: 'image/jpeg',
				size: 2048,
				buffer: Buffer.from('data'),
			} as Express.Multer.File;

			const createdAt = new Date();
			const mediaFile = {
				id: 'file-uuid-1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				size: 2048,
				createdAt,
			};

			mockMediaService.upload.mockResolvedValue(mediaFile);

			const result = await controller.upload('user-uuid-1', file);

			expect(result).toEqual({
				id: 'file-uuid-1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				size: 2048,
				createdAt,
			});
		});

		it('should throw BadRequestException when no file is provided', async () => {
			await expect(
				controller.upload('user-uuid-1', undefined as unknown as Express.Multer.File)
			).rejects.toThrow(new BadRequestException('No file provided'));
		});

		it('should throw BadRequestException when uploaderId header is missing', async () => {
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
		it('should set correct headers and pipe stream to response', async () => {
			const stream = new Readable({ read() {} });

			mockMediaService.getStream.mockResolvedValue({
				stream,
				mimeType: 'image/jpeg',
				filename: 'photo.jpg',
			});

			const setHeader = jest.fn();
			const pipe = jest
				.spyOn(stream, 'pipe')
				.mockImplementation(() => stream as unknown as NodeJS.WritableStream);
			const res = { setHeader, pipe } as unknown as import('express').Response;

			await controller.download('file-uuid-1', res);

			expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
			expect(setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="photo.jpg"');
			expect(pipe).toHaveBeenCalledWith(res);
		});
	});

	describe('delete()', () => {
		it('should throw BadRequestException when requesterId header is missing', async () => {
			await expect(controller.delete('file-uuid-1', undefined as unknown as string)).rejects.toThrow(
				new BadRequestException('Missing x-user-id header')
			);
		});

		it('should call mediaService.delete and return void when requesterId is provided', async () => {
			mockMediaService.delete.mockResolvedValue(undefined);

			const result = await controller.delete('file-uuid-1', 'user-uuid-1');

			expect(mockMediaService.delete).toHaveBeenCalledWith('file-uuid-1', 'user-uuid-1');
			expect(result).toBeUndefined();
		});
	});
});

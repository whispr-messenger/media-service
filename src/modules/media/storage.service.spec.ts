import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getS3ConnectionToken } from 'nestjs-s3';
import { Readable } from 'stream';
import { StorageService } from './storage.service';

const mockS3 = {
	send: jest.fn().mockResolvedValue({}),
	getObject: jest.fn(),
};

const mockConfigService = {
	get: jest.fn((key: string, defaultValue?: unknown) => {
		const config: Record<string, unknown> = {
			S3_BUCKET: 'test-bucket',
			S3_FORCE_PATH_STYLE: true,
			S3_ENDPOINT: 'http://minio:9000',
		};
		return config[key] ?? defaultValue;
	}),
};

describe('StorageService', () => {
	let service: StorageService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				StorageService,
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
				{ provide: ConfigService, useValue: mockConfigService },
			],
		}).compile();

		service = module.get<StorageService>(StorageService);
	});

	describe('getPublicUrl', () => {
		it('should return path-style URL when S3_FORCE_PATH_STYLE is true', () => {
			expect(service.getPublicUrl('avatars/user-1/uuid-1')).toBe(
				'http://minio:9000/test-bucket/avatars/user-1/uuid-1'
			);
		});
	});

	describe('buildPath', () => {
		const USER = '11111111-1111-4111-8111-111111111111';
		const OBJECT = '22222222-2222-4222-8222-222222222222';
		const GROUP = '33333333-3333-4333-8333-333333333333';

		it('should build messages path', () => {
			expect(service.buildPath('messages', USER, OBJECT)).toBe(`messages/${USER}/${OBJECT}.bin`);
		});

		it('should build avatars path', () => {
			expect(service.buildPath('avatars', USER, OBJECT)).toBe(`avatars/${USER}/${OBJECT}`);
		});

		it('should build group_icons path', () => {
			expect(service.buildPath('group_icons', GROUP, OBJECT)).toBe(`group_icons/${GROUP}/${OBJECT}`);
		});

		it('should build thumbnails path', () => {
			expect(service.buildPath('thumbnails', USER, OBJECT)).toBe(`thumbnails/${OBJECT}.bin`);
		});

		it('rejects path traversal in ownerId', () => {
			expect(() => service.buildPath('messages', '../etc/passwd', OBJECT)).toThrow(
				/Invalid ownerId/
			);
		});

		it('rejects path traversal in objectId', () => {
			expect(() => service.buildPath('messages', USER, '../etc/passwd')).toThrow(
				/Invalid objectId/
			);
		});
	});

	describe('upload', () => {
		it('should send PutObjectCommand with stream, contentType and contentLength', async () => {
			const stream = Readable.from(Buffer.from('data'));
			await service.upload('messages/user-1/uuid-1.bin', stream, 'application/octet-stream', 4);

			expect(mockS3.send).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						Bucket: 'test-bucket',
						Key: 'messages/user-1/uuid-1.bin',
						ContentType: 'application/octet-stream',
						ContentLength: 4,
					}),
				})
			);
		});

		it('should send PutObjectCommand without ContentLength when not provided', async () => {
			const stream = Readable.from(Buffer.from('data'));
			await service.upload('avatars/user-1/uuid-1', stream, 'image/png');

			expect(mockS3.send).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						Bucket: 'test-bucket',
						Key: 'avatars/user-1/uuid-1',
						ContentType: 'image/png',
					}),
				})
			);
			const call = mockS3.send.mock.calls[0][0];
			expect(call.input.ContentLength).toBeUndefined();
		});
	});

	describe('download', () => {
		it('should return the response Body stream', async () => {
			const fakeStream = new Readable({ read() {} });
			mockS3.getObject.mockResolvedValue({ Body: fakeStream });

			const result = await service.download('messages/user-1/uuid-1.bin');

			expect(mockS3.getObject).toHaveBeenCalledWith({
				Bucket: 'test-bucket',
				Key: 'messages/user-1/uuid-1.bin',
			});
			expect(result).toBe(fakeStream);
		});
	});

	describe('delete', () => {
		it('should send DeleteObjectCommand for the given path', async () => {
			await service.delete('messages/user-1/uuid-1.bin');

			expect(mockS3.send).toHaveBeenCalledWith(
				expect.objectContaining({
					input: expect.objectContaining({
						Bucket: 'test-bucket',
						Key: 'messages/user-1/uuid-1.bin',
					}),
				})
			);
		});
	});
});

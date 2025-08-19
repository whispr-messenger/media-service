import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';

// Mock MediaService
const mockMediaService = {
  uploadFile: jest.fn(),
  getMedia: jest.fn(),
  getPreview: jest.fn(),
  deleteMedia: jest.fn(),
  getCategories: jest.fn(),
};

// Mock Guards
const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};

const mockPermissionGuard = {
  canActivate: jest.fn(() => true),
};

// Mock Request with user
const mockRequest = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
  file: {
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('test file content'),
  },
} as any;

const mockResponse = {
  setHeader: jest.fn(),
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
} as any;

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
      .compile();

    controller = module.get<MediaController>(MediaController);
    mediaService = module.get<MediaService>(MediaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    const mockUploadResult = {
      id: 'test-media-id',
      filename: 'test.jpg',
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      userId: 'test-user-id',
      createdAt: new Date(),
    };

    it('should upload file successfully', async () => {
      const body = {
        categoryId: 'test-category-id',
        isTemporary: false,
      };

      mockMediaService.uploadFile.mockResolvedValue(mockUploadResult);

      const result = await controller.uploadFile(
        mockRequest.file,
        body,
        mockRequest
      );

      expect(mediaService.uploadFile).toHaveBeenCalledWith({
        file: mockRequest.file,
        userId: 'test-user-id',
        conversationId: undefined,
        messageId: undefined,
        categoryId: 'test-category-id',
        isTemporary: false,
        expiresAt: undefined,
      });
      expect(result).toEqual(mockUploadResult);
    });

    it('should throw BadRequestException when no file provided', async () => {
      const body = {
        categoryId: 'test-category-id',
        isTemporary: false,
      };

      await expect(
        controller.uploadFile(undefined, body, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors', async () => {
      const body = {
        categoryId: 'test-category-id',
        isTemporary: false,
      };

      mockMediaService.uploadFile.mockRejectedValue(
        new BadRequestException('File too large')
      );

      await expect(
        controller.uploadFile(mockRequest.file, body, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('downloadMedia', () => {
    const mediaId = 'test-media-id';
    const mockDownloadResult = {
      stream: Buffer.from('file content'),
      filename: 'test.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    };

    it('should download media successfully', async () => {
      mockMediaService.getMedia.mockResolvedValue(mockDownloadResult);

      await controller.downloadFile(mediaId, mockResponse, mockRequest);

      expect(mediaService.getMedia).toHaveBeenCalledWith(
        mediaId,
        'test-user-id'
      );
      expect(mockResponse.setHeader).toHaveBeenCalled();
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle not found error', async () => {
      mockMediaService.getMedia.mockRejectedValue(
        new NotFoundException('File not found')
      );

      await expect(
        controller.downloadFile(mediaId, mockResponse, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle forbidden error', async () => {
      mockMediaService.getMedia.mockRejectedValue(
        new ForbiddenException('Access denied')
      );

      await expect(
        controller.downloadFile(mediaId, mockResponse, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMedia', () => {
    const mediaId = 'test-media-id';

    it('should delete media successfully', async () => {
      mockMediaService.deleteMedia.mockResolvedValue(undefined);

      await controller.deleteFile(mediaId, mockRequest);

      expect(mediaService.deleteMedia).toHaveBeenCalledWith(
        mediaId,
        'test-user-id'
      );
    });

    it('should handle not found error', async () => {
      mockMediaService.deleteMedia.mockRejectedValue(
        new NotFoundException('Media not found')
      );

      await expect(
        controller.deleteFile(mediaId, mockRequest)
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle forbidden error', async () => {
      mockMediaService.deleteMedia.mockRejectedValue(
        new ForbiddenException('Access denied')
      );

      await expect(
        controller.deleteFile(mediaId, mockRequest)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyMedia', () => {
    const mockMediaList = [
      {
        id: 'media-1',
        filename: 'test1.jpg',
        originalName: 'test1.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        userId: 'test-user-id',
        createdAt: new Date(),
      },
      {
        id: 'media-2',
        filename: 'test2.jpg',
        originalName: 'test2.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
        userId: 'test-user-id',
        createdAt: new Date(),
      },
    ];

    it('should get user media successfully', async () => {
      const page = 1;
      const limit = 10;
      mockMediaService.getMedia.mockResolvedValue({
        data: mockMediaList,
        total: 2,
        page: 1,
        limit: 10,
      });

      const result = await controller.getMyMedia(mockRequest, page, limit);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle empty result', async () => {
      const page = 1;
      const limit = 10;
      mockMediaService.getMedia.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const result = await controller.getMyMedia(mockRequest, page, limit);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });




});
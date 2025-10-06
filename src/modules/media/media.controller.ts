import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Res,
  Query,
  BadRequestException,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { MediaService, UploadFileDto, MediaResponse } from './media.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import {
  RequirePermissions,
  MediaPermissions,
} from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MediaPermissions.UPLOAD)
  @ApiOperation({ summary: 'Upload a media file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        userId: {
          type: 'string',
          description: 'ID of the user uploading the file',
        },
        conversationId: {
          type: 'string',
          description: 'Optional conversation ID',
        },
        messageId: {
          type: 'string',
          description: 'Optional message ID',
        },
        categoryId: {
          type: 'string',
          description: 'Optional category ID',
        },
        isTemporary: {
          type: 'boolean',
          description: 'Whether the file is temporary',
        },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'Optional expiration date',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: 'object',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid file or parameters',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
      fileFilter: (req, file, callback) => {
        // Basic file type validation
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'audio/mpeg',
          'audio/wav',
          'audio/aac',
          'audio/ogg',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/zip',
          'application/x-rar-compressed',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Type de fichier non autorisé'),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Request() req: any,
  ): Promise<MediaResponse> {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    const userId = req.user.id;

    const uploadDto: UploadFileDto = {
      file,
      userId: userId,
      conversationId: body.conversationId,
      messageId: body.messageId,
      categoryId: body.categoryId,
      isTemporary: body.isTemporary === 'true',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    };

    return this.mediaService.uploadFile(uploadDto);
  }

  @Get(':id/download')
  @RequirePermissions(MediaPermissions.DOWNLOAD)
  @ApiOperation({ summary: 'Download a media file' })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async downloadFile(
    @Param('id') mediaId: string,
    @Res() res: Response,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user.id;

    try {
      const fileBuffer = await this.mediaService.getMedia(mediaId, userId);

      // TODO: Récupérer les métadonnées du fichier pour définir les headers appropriés
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${mediaId}"`);

      res.send(fileBuffer);
    } catch (error) {
      throw new BadRequestException('Erreur lors du téléchargement du fichier');
    }
  }

  @Get(':id/preview')
  @Public()
  @ApiOperation({ summary: 'Get media preview' })
  @ApiResponse({
    status: 200,
    description: 'Preview retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Preview not found',
  })
  async getPreview(
    @Param('id') mediaId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // TODO: Implémenter la récupération de preview
      const previewBuffer = Buffer.alloc(0); // Placeholder

      res.setHeader('Content-Type', 'image/jpeg');
      res.send(previewBuffer);
    } catch (error) {
      throw new BadRequestException(
        'Erreur lors de la récupération de la preview',
      );
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(MediaPermissions.DELETE)
  @ApiOperation({ summary: 'Delete a media file' })
  @ApiResponse({
    status: 204,
    description: 'File deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async deleteFile(
    @Param('id') mediaId: string,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user.id;
    await this.mediaService.deleteMedia(mediaId, userId);
  }

  @Get('my-media')
  @ApiOperation({ summary: 'Get my media files' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'My media files retrieved successfully',
  })
  async getMyMedia(
    @Request() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ): Promise<any> {
    const userId = req.user.id;
    // TODO: Implémenter la récupération des médias utilisateur avec pagination
    return {
      data: [],
      pagination: {
        page: page,
        limit: limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  @Get('user/:userId')
  @RequirePermissions(MediaPermissions.VIEW_ALL)
  @ApiOperation({ summary: 'Get user media files (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'User media files retrieved successfully',
  })
  async getUserMedia(
    @Param('userId') _userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ): Promise<any> {
    // TODO: Implémenter la récupération des médias utilisateur avec pagination
    return {
      data: [],
      pagination: {
        page: page,
        limit: limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get available media categories' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async getCategories(): Promise<any> {
    // TODO: Implémenter la récupération des catégories
    return [];
  }
}

import {
	Controller,
	Post,
	Get,
	Delete,
	Param,
	Headers,
	UploadedFile,
	UseInterceptors,
	Res,
	HttpCode,
	HttpStatus,
	BadRequestException,
	Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiHeader } from '@nestjs/swagger';
import { Response } from 'express';
import { MediaService } from './media.service';
import { UploadMediaResponseDto } from './dto/upload-media.dto';

@ApiTags('Media')
@ApiHeader({ name: 'x-user-id', description: 'UUID of the authenticated user', required: true })
@Controller('files')
export class MediaController {
	private readonly logger = new Logger(MediaController.name);

	constructor(private readonly mediaService: MediaService) {}

	@Post()
	@ApiOperation({ summary: 'Upload a media file' })
	@ApiConsumes('multipart/form-data')
	@ApiResponse({ status: 201, description: 'File uploaded successfully', type: UploadMediaResponseDto })
	@ApiResponse({ status: 400, description: 'No file provided' })
	@UseInterceptors(FileInterceptor('file'))
	async upload(
		@Headers('x-user-id') uploaderId: string,
		@UploadedFile() file: Express.Multer.File
	): Promise<UploadMediaResponseDto> {
		if (!file) {
			throw new BadRequestException('No file provided');
		}
		if (!uploaderId) {
			throw new BadRequestException('Missing x-user-id header');
		}

		this.logger.debug(`Upload request from user ${uploaderId}`);
		const mediaFile = await this.mediaService.upload(uploaderId, file);

		return {
			id: mediaFile.id,
			filename: mediaFile.filename,
			mimeType: mediaFile.mimeType,
			size: mediaFile.size,
			createdAt: mediaFile.createdAt,
		};
	}

	@Get(':id')
	@ApiOperation({ summary: 'Download a media file' })
	@ApiResponse({ status: 200, description: 'File stream' })
	@ApiResponse({ status: 404, description: 'File not found' })
	async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
		const { stream, mimeType, filename } = await this.mediaService.getStream(id);
		res.setHeader('Content-Type', mimeType);
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		stream.pipe(res);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Delete a media file' })
	@ApiResponse({ status: 204, description: 'File deleted' })
	@ApiResponse({ status: 404, description: 'File not found' })
	async delete(@Param('id') id: string, @Headers('x-user-id') requesterId: string): Promise<void> {
		if (!requesterId) {
			throw new BadRequestException('Missing x-user-id header');
		}
		await this.mediaService.delete(id, requesterId);
	}
}

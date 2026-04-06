import {
	Controller,
	Post,
	Get,
	Delete,
	Patch,
	Param,
	Headers,
	UploadedFiles,
	UseInterceptors,
	Res,
	Req,
	HttpCode,
	HttpStatus,
	BadRequestException,
	Logger,
	Body,
	ParseUUIDPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiHeader, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { MediaService } from './media.service';
import {
	MediaContext,
	UploadMediaDto,
	UploadMediaResponseDto,
	MediaMetadataDto,
} from './dto/upload-media.dto';

@ApiTags('Media')
@ApiHeader({ name: 'x-user-id', description: 'UUID of the authenticated user', required: true })
@Controller()
export class MediaController {
	private readonly logger = new Logger(MediaController.name);

	constructor(private readonly mediaService: MediaService) {}

	// =========================================================================
	// POST /media/v1/upload — WHISPR-359
	// =========================================================================

	@Post('upload')
	@ApiOperation({ summary: 'Upload a media file (blob + optional thumbnail)' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['file'],
			properties: {
				file: { type: 'string', format: 'binary' },
				thumbnail: { type: 'string', format: 'binary' },
				context: { type: 'string', enum: Object.values(MediaContext) },
				ownerId: { type: 'string', format: 'uuid' },
			},
		},
	})
	@ApiResponse({ status: 201, type: UploadMediaResponseDto })
	@ApiResponse({ status: 400, description: 'Validation error' })
	@ApiResponse({ status: 413, description: 'Quota exceeded or file too large' })
	@ApiResponse({ status: 415, description: 'Content-Type mismatch (magic bytes)' })
	@ApiResponse({ status: 429, description: 'Too many concurrent uploads' })
	@UseInterceptors(
		FileFieldsInterceptor([
			{ name: 'file', maxCount: 1 },
			{ name: 'thumbnail', maxCount: 1 },
		])
	)
	async upload(
		@Headers('x-user-id') headerOwnerId: string,
		@UploadedFiles()
		files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
		@Body() dto: UploadMediaDto
	): Promise<UploadMediaResponseDto> {
		const file = files?.file?.[0];
		const thumbnail = files?.thumbnail?.[0];

		if (!file) {
			throw new BadRequestException('No file provided');
		}
		if (!headerOwnerId) {
			throw new BadRequestException('Missing x-user-id header');
		}
		// The ownerId in the body must match the authenticated user
		const ownerId = dto.ownerId ?? headerOwnerId;
		if (ownerId !== headerOwnerId) {
			throw new BadRequestException('ownerId must match the authenticated user');
		}

		const context = dto.context ?? MediaContext.MESSAGE;

		this.logger.debug(`Upload request from user ${ownerId} context=${context}`);
		return this.mediaService.upload(ownerId, file, context, thumbnail);
	}

	// =========================================================================
	// GET /media/v1/:id — WHISPR-364
	// =========================================================================

	@Get(':id')
	@ApiOperation({ summary: 'Get media metadata' })
	@ApiResponse({ status: 200, type: MediaMetadataDto })
	@ApiResponse({ status: 404, description: 'Not found' })
	async getMetadata(
		@Param('id') id: string,
		@Headers('x-user-id') requesterId: string
	): Promise<MediaMetadataDto> {
		if (!requesterId) {
			throw new BadRequestException('Missing x-user-id header');
		}
		return this.mediaService.getMetadata(id, requesterId);
	}

	// =========================================================================
	// GET /media/v1/:id/blob — WHISPR-365
	// =========================================================================

	@Get(':id/blob')
	@ApiOperation({ summary: 'Redirect to presigned blob URL' })
	@ApiResponse({ status: 302, description: 'Redirect to signed URL' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async getBlobUrl(
		@Param('id') id: string,
		@Headers('x-user-id') requesterId: string,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		if (!requesterId) {
			throw new BadRequestException('Missing x-user-id header');
		}
		const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
		const ua = req.headers['user-agent'];
		const url = await this.mediaService.getBlobUrl(id, requesterId, ip, ua);
		res.redirect(302, url);
	}

	// =========================================================================
	// GET /media/v1/:id/thumbnail — WHISPR-366
	// =========================================================================

	@Get(':id/thumbnail')
	@ApiOperation({ summary: 'Redirect to presigned thumbnail URL' })
	@ApiResponse({ status: 302, description: 'Redirect to thumbnail URL' })
	@ApiResponse({ status: 404, description: 'Not found or no thumbnail' })
	async getThumbnailUrl(
		@Param('id') id: string,
		@Headers('x-user-id') requesterId: string,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		if (!requesterId) {
			throw new BadRequestException('Missing x-user-id header');
		}
		const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
		const ua = req.headers['user-agent'];
		const url = await this.mediaService.getThumbnailUrl(id, requesterId, ip, ua);
		res.redirect(302, url);
	}

	// =========================================================================
	// DELETE /media/v1/:id — WHISPR-367
	// =========================================================================

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Soft delete media — releases quota' })
	@ApiResponse({ status: 204, description: 'Deleted' })
	@ApiResponse({ status: 403, description: 'Not owner' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async delete(
		@Param('id') id: string,
		@Headers('x-user-id') requesterId: string,
		@Req() req: Request
	): Promise<void> {
		if (!requesterId) {
			throw new BadRequestException('Missing x-user-id header');
		}
		const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
		const ua = req.headers['user-agent'];
		await this.mediaService.delete(id, requesterId, ip, ua);
	}

	// =========================================================================
	// PATCH /media/v1/:id/moderation — Moderation verdict
	// =========================================================================

	@Patch(':id/moderation')
	@ApiOperation({ summary: 'Update moderation status (called by moderation-service)' })
	@ApiResponse({ status: 200, description: 'Moderation status updated' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async updateModeration(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: { status: string; score?: number; category?: string }
	) {
		return this.mediaService.updateModerationStatus(id, body.status, body.score, body.category);
	}
}

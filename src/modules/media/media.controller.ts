import {
	Controller,
	Post,
	Get,
	Delete,
	Param,
	Query,
	UploadedFiles,
	UseInterceptors,
	Res,
	Req,
	HttpCode,
	HttpStatus,
	BadRequestException,
	Logger,
	Body,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { MediaService } from './media.service';
import {
	MediaContext,
	UploadMediaDto,
	UploadMediaResponseDto,
	MediaMetadataDto,
} from './dto/upload-media.dto';
import { UserQuotaResponseDto } from './dto/user-quota-response.dto';
import { PaginatedMediaResponseDto } from './dto/paginated-media-response.dto';

@ApiTags('Media')
@Controller()
export class MediaController {
	private readonly logger = new Logger(MediaController.name);

	constructor(private readonly mediaService: MediaService) {}

	// =========================================================================
	// POST /media/upload — WHISPR-359
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
		@Req() req: Request,
		@UploadedFiles()
		files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
		@Body() dto: UploadMediaDto
	): Promise<UploadMediaResponseDto> {
		const authenticatedUserId = (req as any).user?.userId as string;
		const file = files?.file?.[0];
		const thumbnail = files?.thumbnail?.[0];

		if (!file) {
			throw new BadRequestException('No file provided');
		}
		if (!authenticatedUserId) {
			throw new BadRequestException('Missing authenticated user');
		}
		// The ownerId in the body must match the authenticated user
		const ownerId = dto.ownerId ?? authenticatedUserId;
		if (ownerId !== authenticatedUserId) {
			throw new BadRequestException('ownerId must match the authenticated user');
		}

		const context = dto.context ?? MediaContext.MESSAGE;

		this.logger.debug(`Upload request from user ${ownerId} context=${context}`);
		return this.mediaService.upload(ownerId, file, context, thumbnail);
	}

	// =========================================================================
	// GET /media/quota — WHISPR-368
	// =========================================================================

	@Get('quota')
	@ApiOperation({ summary: 'Get current user quota' })
	@ApiResponse({ status: 200, description: 'User quota retrieved', type: UserQuotaResponseDto })
	async getQuota(@Req() req: Request): Promise<UserQuotaResponseDto> {
		const userId = (req as any).user?.userId as string;
		return this.mediaService.getUserQuota(userId);
	}

	// =========================================================================
	// GET /media/my-media — WHISPR-375
	// =========================================================================

	@Get('my-media')
	@ApiOperation({ summary: 'Get paginated list of current user media (GDPR)' })
	@ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Items per page (default: 20, max: 100)',
	})
	@ApiResponse({ status: 200, description: 'Paginated media list', type: PaginatedMediaResponseDto })
	async getMyMedia(
		@Req() req: Request,
		@Query('page') rawPage?: string,
		@Query('limit') rawLimit?: string
	): Promise<PaginatedMediaResponseDto> {
		const userId = (req as any).user?.userId as string;
		const page = Math.max(1, Number.parseInt(rawPage ?? '', 10) || 1);
		const limit = Math.min(100, Math.max(1, Number.parseInt(rawLimit ?? '', 10) || 20));

		return this.mediaService.getUserMedia(userId, page, limit);
	}

	// =========================================================================
	// GET /media/:id — WHISPR-364
	// =========================================================================

	@Get(':id')
	@ApiOperation({ summary: 'Get media metadata' })
	@ApiResponse({ status: 200, type: MediaMetadataDto })
	@ApiResponse({ status: 404, description: 'Not found' })
	async getMetadata(@Param('id') id: string, @Req() req: Request): Promise<MediaMetadataDto> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		return this.mediaService.getMetadata(id, requesterId);
	}

	// =========================================================================
	// GET /media/:id/blob — WHISPR-365
	// =========================================================================

	@Get(':id/blob')
	@ApiOperation({ summary: 'Redirect to presigned blob URL' })
	@ApiResponse({ status: 302, description: 'Redirect to signed URL' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async getBlobUrl(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
		const ua = req.headers['user-agent'];
		const url = await this.mediaService.getBlobUrl(id, requesterId, ip, ua);
		res.redirect(302, url);
	}

	// =========================================================================
	// GET /media/:id/thumbnail — WHISPR-366
	// =========================================================================

	@Get(':id/thumbnail')
	@ApiOperation({ summary: 'Redirect to presigned thumbnail URL' })
	@ApiResponse({ status: 302, description: 'Redirect to thumbnail URL' })
	@ApiResponse({ status: 404, description: 'Not found or no thumbnail' })
	async getThumbnailUrl(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
		const ua = req.headers['user-agent'];
		const url = await this.mediaService.getThumbnailUrl(id, requesterId, ip, ua);
		res.redirect(302, url);
	}

	// =========================================================================
	// DELETE /media/:id — WHISPR-367
	// =========================================================================

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Soft delete media — releases quota' })
	@ApiResponse({ status: 204, description: 'Deleted' })
	@ApiResponse({ status: 403, description: 'Not owner' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress;
		const ua = req.headers['user-agent'];
		await this.mediaService.delete(id, requesterId, ip, ua);
	}
}

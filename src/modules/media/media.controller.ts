import {
	Controller,
	Post,
	Get,
	Patch,
	Delete,
	Param,
	Query,
	UploadedFiles,
	UseInterceptors,
	Req,
	HttpCode,
	HttpStatus,
	BadRequestException,
	Logger,
	Body,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { MediaService } from './media.service';
import {
	MediaContext,
	UploadMediaDto,
	UploadMediaResponseDto,
	MediaMetadataDto,
	ShareMediaDto,
} from './dto/upload-media.dto';
import { UserQuotaResponseDto } from './dto/user-quota-response.dto';
import { PaginatedMediaResponseDto } from './dto/paginated-media-response.dto';

/**
 * Hard upper bound applied by multer / FileFieldsInterceptor so a malicious
 * client can't DoS the pod by streaming an unbounded body into memory
 * (WHISPR-1013). Per-context limits (MESSAGE=100MB, AVATAR/GROUP_ICON=5MB)
 * are still enforced at the service layer — this is the outer guard.
 */
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

@ApiTags('Media')
@Controller()
export class MediaController {
	private readonly logger = new Logger(MediaController.name);

	constructor(private readonly mediaService: MediaService) {}

	// =========================================================================
	// POST /media/v1/upload — WHISPR-359
	// =========================================================================

	@Post('upload')
	// WHISPR-1012: bornes plus strictes que les tiers globaux
	// (SHORT 3/1s, MEDIUM 20/10s, LONG 100/60s). Un upload consomme S3 +
	// quota DB + semaphore, donc on cap 20 envois/minute/IP pour limiter
	// l'abus sans gêner un usage normal.
	@Throttle({ default: { ttl: 60_000, limit: 20 } })
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
				sharedWith: {
					type: 'string',
					description: 'JSON array or CSV of user UUIDs to share with',
				},
			},
		},
	})
	@ApiResponse({ status: 201, type: UploadMediaResponseDto })
	@ApiResponse({ status: 400, description: 'Validation error' })
	@ApiResponse({ status: 413, description: 'Quota exceeded or file too large' })
	@ApiResponse({ status: 415, description: 'Content-Type mismatch (magic bytes)' })
	@ApiResponse({ status: 429, description: 'Too many concurrent uploads' })
	@UseInterceptors(
		FileFieldsInterceptor(
			[
				{ name: 'file', maxCount: 1 },
				{ name: 'thumbnail', maxCount: 1 },
			],
			{ limits: { fileSize: UPLOAD_MAX_BYTES } }
		)
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
		return this.mediaService.upload(ownerId, file, context, thumbnail, dto.sharedWith);
	}

	// =========================================================================
	// GET /media/v1/quota — WHISPR-368
	// =========================================================================

	@Get('quota')
	@ApiOperation({ summary: 'Get current user quota' })
	@ApiResponse({ status: 200, description: 'User quota retrieved', type: UserQuotaResponseDto })
	async getQuota(@Req() req: Request): Promise<UserQuotaResponseDto> {
		const userId = (req as any).user?.userId as string;
		return this.mediaService.getUserQuota(userId);
	}

	// =========================================================================
	// GET /media/v1/my-media — WHISPR-375
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
	// GET /media/v1/:id — WHISPR-364
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
	// GET /media/v1/:id/blob — WHISPR-365
	// =========================================================================

	// Retourne 200 JSON `{ url, expiresAt }` plutôt qu'un 302 : le redirect
	// vers MinIO (même origine que l'API) propage l'en-tête `Authorization:
	// Bearer …` qui, combiné à `X-Amz-Signature` dans l'URL présignée,
	// déclenche une erreur S3 « multiple authentication types ». Le client
	// fetch l'URL et la pose ensuite dans `<img src>` sans Authorization.
	@Get(':id/blob')
	@ApiOperation({ summary: 'Get a presigned GET URL for the blob' })
	@ApiResponse({ status: 200, description: 'Presigned blob URL' })
	@ApiResponse({ status: 403, description: 'Access denied' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async getBlobUrl(
		@Param('id') id: string,
		@Req() req: Request
	): Promise<{ url: string; expiresAt: Date | null }> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const ip = this.extractClientIp(req);
		const ua = req.headers['user-agent'];
		return this.mediaService.getBlob(id, requesterId, ip, ua);
	}

	// =========================================================================
	// GET /media/v1/:id/thumbnail — WHISPR-366
	// =========================================================================

	// Même logique que /blob (200 JSON). Quand aucune thumbnail n'est stockée,
	// on renvoie `{ url: null, expiresAt: null }` plutôt qu'un 404, ce qui
	// permet au client de fallback silencieusement sur /blob.
	@Get(':id/thumbnail')
	@ApiOperation({ summary: 'Get a presigned GET URL for the thumbnail (url=null if none)' })
	@ApiResponse({ status: 200, description: 'Presigned thumbnail URL or null' })
	@ApiResponse({ status: 403, description: 'Access denied' })
	@ApiResponse({ status: 404, description: 'Media not found' })
	async getThumbnailUrl(
		@Param('id') id: string,
		@Req() req: Request
	): Promise<{ url: string | null; expiresAt: Date | null }> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const ip = this.extractClientIp(req);
		const ua = req.headers['user-agent'];
		return this.mediaService.getThumbnail(id, requesterId, ip, ua);
	}

	// =========================================================================
	// PATCH /media/v1/:id/share — ACL shared_with
	// =========================================================================

	@Patch(':id/share')
	@ApiOperation({ summary: 'Add users to the media shared_with ACL (owner only)' })
	@ApiResponse({ status: 200, description: 'Updated shared_with list' })
	@ApiResponse({ status: 403, description: 'Not owner' })
	@ApiResponse({ status: 404, description: 'Not found' })
	async share(
		@Param('id') id: string,
		@Req() req: Request,
		@Body() dto: ShareMediaDto
	): Promise<{ sharedWith: string[] }> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const sharedWith = await this.mediaService.share(id, requesterId, dto.userIds);
		return { sharedWith };
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
	async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
		const requesterId = (req as any).user?.userId as string;
		if (!requesterId) {
			throw new BadRequestException('Missing authenticated user');
		}
		const ip = this.extractClientIp(req);
		const ua = req.headers['user-agent'];
		await this.mediaService.delete(id, requesterId, ip, ua);
	}

	/**
	 * Extrait la première IP client exploitable depuis la requête.
	 *
	 * `x-forwarded-for` peut contenir une liste CSV "client, proxy1, proxy2"
	 * et la valeur peut aussi arriver en array quand le header est dupliqué.
	 * On ne garde que le premier token, on le tronque à 45 caractères (IPv6)
	 * pour rester sous la contrainte de la colonne `ip_address`, et on
	 * retombe sur l'adresse TCP si le header est absent. Sans ça, un client
	 * malveillant peut insérer un header géant qui fait échouer l'insert DB.
	 */
	private extractClientIp(req: Request): string | undefined {
		const forwarded = req.headers['x-forwarded-for'];
		const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
		if (typeof forwardedStr === 'string' && forwardedStr.length > 0) {
			const first = forwardedStr.split(',')[0].trim();
			if (first) return first.slice(0, 45);
		}
		return req.socket?.remoteAddress?.slice(0, 45);
	}
}

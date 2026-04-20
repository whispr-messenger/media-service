import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export enum MediaContext {
	MESSAGE = 'message',
	AVATAR = 'avatar',
	GROUP_ICON = 'group_icon',
}

// Parse un champ multipart qui peut arriver comme string JSON, string CSV,
// ou tableau déjà parsé. Retourne toujours un tableau ou undefined.
function parseStringArray(value: unknown): string[] | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(trimmed);
				if (!Array.isArray(parsed)) return trimmed as unknown as string[];
				return parsed.map(String);
			} catch {
				return trimmed as unknown as string[];
			}
		}
		return trimmed
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}
	return value as unknown as string[];
}

export class UploadMediaDto {
	@ApiPropertyOptional({ description: 'Upload context', enum: MediaContext })
	@IsOptional()
	@IsEnum(MediaContext)
	context?: MediaContext;

	@ApiPropertyOptional({ description: 'UUID of the resource owner' })
	@IsOptional()
	@IsUUID()
	ownerId?: string;

	// WHISPR-XXX : liste d'UUIDs supplémentaires autorisés à lire ce média
	// (typiquement, les membres de la conversation à laquelle il sera attaché).
	// Peut être envoyé en multipart sous forme de CSV ("uuid1,uuid2") ou de
	// JSON ("[\"uuid1\",\"uuid2\"]").
	@ApiPropertyOptional({
		description: 'UUIDs explicitly allowed to read this media (e.g. conversation members)',
		type: [String],
	})
	@IsOptional()
	@Transform(({ value }) => parseStringArray(value))
	@IsArray()
	@IsUUID(undefined, { each: true })
	sharedWith?: string[];
}

export class ShareMediaDto {
	// WHISPR-XXX : PATCH /:id/share — liste d'UUIDs à ajouter à l'ACL.
	@ApiProperty({
		description: 'UUIDs to add to the shared_with ACL (union with existing)',
		type: [String],
	})
	@IsArray()
	@IsUUID(undefined, { each: true })
	userIds: string[];
}

export class UploadMediaResponseDto {
	@ApiProperty({ description: 'Unique identifier of the uploaded media' })
	media_id: string;

	@ApiPropertyOptional({ description: 'Presigned GET URL for the blob (short-lived)' })
	url: string | null;

	@ApiPropertyOptional({ description: 'Presigned GET URL for the thumbnail (short-lived)' })
	thumbnail_url: string | null;

	@ApiPropertyOptional({
		description: 'Expiration timestamp of the presigned URLs (ISO-8601)',
	})
	expires_at: Date | null;

	@ApiProperty({ description: 'Upload context', enum: MediaContext })
	context: MediaContext;

	@ApiProperty({ description: 'Blob size in bytes' })
	size: number;
}

export class MediaMetadataDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	ownerId: string;

	@ApiProperty({ enum: MediaContext })
	context: MediaContext;

	@ApiProperty()
	contentType: string;

	@ApiProperty()
	blobSize: number;

	@ApiPropertyOptional()
	expiresAt: Date | null;

	@ApiProperty()
	isActive: boolean;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	hasThumbnail: boolean;
}

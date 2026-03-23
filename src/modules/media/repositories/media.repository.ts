import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../entities/media.entity';

@Injectable()
export class MediaRepository {
	constructor(@InjectRepository(Media) private readonly repo: Repository<Media>) {}

	// SECURITY: These repository methods use implicit transactions. The RLS GUC
	// (`app.current_user_id`) is only set inside explicit transactions via the
	// RlsSubscriber. If RLS filtering is required for any of these operations,
	// wrap the call site in `dataSource.transaction(…)`.

	async save(media: Media): Promise<Media> {
		return this.repo.save(media);
	}

	async findById(id: string): Promise<Media | null> {
		return this.repo.findOne({ where: { id, isActive: true } });
	}

	async updateSignedUrlExpiry(id: string, signedUrlExpiresAt: Date): Promise<void> {
		await this.repo.update(id, { signedUrlExpiresAt });
	}

	async softDelete(id: string): Promise<void> {
		await this.repo.update(id, { isActive: false });
	}
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Media } from '../entities/media.entity';

@Injectable()
export class MediaRepository {
	constructor(@InjectRepository(Media) private readonly repo: Repository<Media>) {}

	// SECURITY: These repository methods use implicit transactions. The RLS GUC
	// (`app.current_user_id`) is only set inside explicit transactions via the
	// RlsSubscriber. If RLS filtering is required for any of these operations,
	// wrap the call site in `dataSource.transaction(…)`.

	private getRepository(manager?: EntityManager): Repository<Media> {
		return manager ? manager.getRepository(Media) : this.repo;
	}

	async save(media: Media, manager?: EntityManager): Promise<Media> {
		return this.getRepository(manager).save(media);
	}

	async findById(id: string, manager?: EntityManager): Promise<Media | null> {
		return this.getRepository(manager).findOne({ where: { id, isActive: true } });
	}

	async updateSignedUrlExpiry(
		id: string,
		signedUrlExpiresAt: Date,
		manager?: EntityManager
	): Promise<void> {
		await this.getRepository(manager).update(id, { signedUrlExpiresAt });
	}

	async softDelete(id: string, manager?: EntityManager): Promise<void> {
		await this.getRepository(manager).update(id, { isActive: false });
	}
}

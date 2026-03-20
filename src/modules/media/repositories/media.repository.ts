import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../entities/media.entity';

@Injectable()
export class MediaRepository {
	constructor(@InjectRepository(Media) private readonly repo: Repository<Media>) {}

	async save(media: Media): Promise<Media> {
		return this.repo.save(media);
	}

	async findById(id: string): Promise<Media | null> {
		return this.repo.findOne({ where: { id, isActive: true } });
	}

	async softDelete(id: string): Promise<void> {
		await this.repo.update(id, { isActive: false });
	}
}

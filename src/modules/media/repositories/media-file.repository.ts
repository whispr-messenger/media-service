import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaFile, MediaFileStatus } from '../entities/media-file.entity';

@Injectable()
export class MediaFileRepository {
	constructor(@InjectRepository(MediaFile) private readonly repo: Repository<MediaFile>) {}

	async save(mediaFile: MediaFile): Promise<MediaFile> {
		return this.repo.save(mediaFile);
	}

	async findById(id: string): Promise<MediaFile | null> {
		return this.repo.findOne({ where: { id, status: MediaFileStatus.ACTIVE } });
	}

	async softDelete(id: string): Promise<void> {
		await this.repo.update(id, { status: MediaFileStatus.DELETED });
	}
}

import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum MediaFileStatus {
	ACTIVE = 'active',
	DELETED = 'deleted',
}

@Entity({ name: 'media_files', schema: 'media' })
export class MediaFile {
	@PrimaryColumn('uuid')
	id: string;

	@Column('uuid')
	uploaderId: string;

	@Column({ type: 'varchar', length: 255 })
	filename: string;

	@Column({ type: 'varchar', length: 512 })
	storageKey: string;

	@Column({ type: 'varchar', length: 128 })
	mimeType: string;

	@Column({ type: 'bigint' })
	size: number;

	@Column({ type: 'enum', enum: MediaFileStatus, default: MediaFileStatus.ACTIVE })
	status: MediaFileStatus;

	@CreateDateColumn({ type: 'timestamptz' })
	createdAt: Date;
}

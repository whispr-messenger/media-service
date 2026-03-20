import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'media', schema: 'media' })
export class Media {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'owner_id', type: 'uuid' })
	ownerId: string;

	@Column({ type: 'varchar', length: 64 })
	context: string;

	@Column({ name: 'storage_path', type: 'varchar', length: 1024 })
	storagePath: string;

	@Column({ name: 'thumbnail_path', type: 'varchar', length: 1024, nullable: true })
	thumbnailPath: string | null;

	@Column({ name: 'content_type', type: 'varchar', length: 128 })
	contentType: string;

	@Column({
		name: 'blob_size',
		type: 'bigint',
		transformer: {
			to: (value: number): number => value,
			from: (value: string): number => Number(value),
		},
	})
	blobSize: number;

	@Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
	expiresAt: Date | null;

	@Column({ name: 'is_active', type: 'boolean', default: true })
	isActive: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt: Date;
}

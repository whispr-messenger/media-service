import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'media_access_logs', schema: 'media' })
export class MediaAccessLog {
	@PrimaryColumn({ name: 'accessed_at', type: 'timestamptz' })
	accessedAt: Date;

	@PrimaryColumn({ type: 'uuid' })
	id: string;

	@Column({ name: 'media_id', type: 'uuid' })
	mediaId: string;

	@Column({ name: 'accessor_id', type: 'uuid', nullable: true })
	accessorId: string | null;

	@Column({ name: 'access_type', type: 'varchar', length: 64 })
	accessType: string;

	@Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
	ipAddress: string | null;

	@Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
	userAgent: string | null;
}

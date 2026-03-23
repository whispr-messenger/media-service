import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'user_quotas', schema: 'media' })
@Index('IDX_user_quotas_quota_date', ['quotaDate'])
export class UserQuota {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'user_id', type: 'uuid' })
	@Index('IDX_user_quotas_user_id', { unique: true })
	userId: string;

	@Column({
		name: 'storage_used',
		type: 'bigint',
		default: 0,
		transformer: {
			to: (value: bigint | number): string => String(value),
			from: (value: string): bigint => BigInt(value),
		},
	})
	storageUsed: bigint;

	@Column({
		name: 'storage_limit',
		type: 'bigint',
		default: 1073741824,
		transformer: {
			to: (value: bigint | number): string => String(value),
			from: (value: string): bigint => BigInt(value),
		},
	})
	storageLimit: bigint;

	@Column({ name: 'files_count', type: 'integer', default: 0 })
	filesCount: number;

	@Column({ name: 'files_limit', type: 'integer', default: 1000 })
	filesLimit: number;

	@Column({ name: 'daily_uploads', type: 'integer', default: 0 })
	dailyUploads: number;

	@Column({ name: 'daily_upload_limit', type: 'integer', default: 100 })
	dailyUploadLimit: number;

	@Column({ name: 'quota_date', type: 'date' })
	quotaDate: string;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt: Date;
}

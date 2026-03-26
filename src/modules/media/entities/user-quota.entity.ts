import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';
import {
	DEFAULT_STORAGE_LIMIT_BYTES,
	DEFAULT_FILES_LIMIT,
	DEFAULT_DAILY_UPLOAD_LIMIT,
} from '../quota.constants';

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
			to: String,
			from: BigInt,
		},
	})
	storageUsed: bigint;

	@Column({
		name: 'storage_limit',
		type: 'bigint',
		default: DEFAULT_STORAGE_LIMIT_BYTES,
		transformer: {
			to: String,
			from: BigInt,
		},
	})
	storageLimit: bigint;

	@Column({ name: 'files_count', type: 'integer', default: 0 })
	filesCount: number;

	@Column({ name: 'files_limit', type: 'integer', default: DEFAULT_FILES_LIMIT })
	filesLimit: number;

	@Column({ name: 'daily_uploads', type: 'integer', default: 0 })
	dailyUploads: number;

	@Column({ name: 'daily_upload_limit', type: 'integer', default: DEFAULT_DAILY_UPLOAD_LIMIT })
	dailyUploadLimit: number;

	@Column({ name: 'quota_date', type: 'date' })
	quotaDate: string;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt: Date;
}

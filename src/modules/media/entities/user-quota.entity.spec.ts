import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { UserQuota } from './user-quota.entity';

describe('UserQuota entity', () => {
	it('is decorated with @Entity pointing to media.user_quotas', () => {
		const tables = getMetadataArgsStorage().tables;
		const meta = tables.find((t) => t.target === UserQuota);
		expect(meta).toBeDefined();
		expect(meta!.schema).toBe('media');
		expect(meta!.name).toBe('user_quotas');
	});

	it('has expected column names', () => {
		const columns = getMetadataArgsStorage().columns.filter((c) => c.target === UserQuota);
		const columnNames = columns.map((c) => c.options?.name ?? c.propertyName);
		expect(columnNames).toEqual(
			expect.arrayContaining([
				'user_id',
				'storage_used',
				'storage_limit',
				'files_count',
				'files_limit',
				'daily_uploads',
				'daily_upload_limit',
				'quota_date',
				'updated_at',
			])
		);
	});

	it('has a unique index on user_id', () => {
		const indices = getMetadataArgsStorage().indices.filter((i) => i.target === UserQuota);
		const userIdIndex = indices.find((i) => i.name === 'IDX_user_quotas_user_id');
		expect(userIdIndex).toBeDefined();
		expect(userIdIndex!.unique).toBe(true);
	});

	it('has an index on quota_date', () => {
		const indices = getMetadataArgsStorage().indices.filter((i) => i.target === UserQuota);
		const quotaDateIndex = indices.find((i) => i.name === 'IDX_user_quotas_quota_date');
		expect(quotaDateIndex).toBeDefined();
	});

	it('bigint columns use transformer to return bigint', () => {
		const columns = getMetadataArgsStorage().columns.filter((c) => c.target === UserQuota);
		const storageUsed = columns.find((c) => (c.options?.name ?? c.propertyName) === 'storage_used');
		const storageLimit = columns.find((c) => (c.options?.name ?? c.propertyName) === 'storage_limit');

		expect(storageUsed?.options?.transformer).toBeDefined();
		const usedTransformer = storageUsed!.options!.transformer as { from: (v: string) => bigint };
		expect(usedTransformer.from('42')).toBe(42n);

		expect(storageLimit?.options?.transformer).toBeDefined();
		const limitTransformer = storageLimit!.options!.transformer as { from: (v: string) => bigint };
		expect(limitTransformer.from('1073741824')).toBe(1073741824n);
	});
});

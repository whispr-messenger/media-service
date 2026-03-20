import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { MediaAccessLog } from './media-access-log.entity';

describe('MediaAccessLog entity', () => {
	it('is decorated with @Entity pointing to media.media_access_logs', () => {
		const tables = getMetadataArgsStorage().tables;
		const meta = tables.find((t) => t.target === MediaAccessLog);
		expect(meta).toBeDefined();
		expect(meta!.schema).toBe('media');
		expect(meta!.name).toBe('media_access_logs');
	});

	it('has composite primary key on accessed_at and id', () => {
		const columns = getMetadataArgsStorage().columns.filter((c) => c.target === MediaAccessLog);
		const pks = columns.filter((c) => c.options?.primary);
		const pkNames = pks.map((c) => c.options?.name ?? c.propertyName);
		expect(pkNames).toContain('accessed_at');
		expect(pkNames).toContain('id');
	});

	it('has expected column names', () => {
		const columns = getMetadataArgsStorage().columns.filter((c) => c.target === MediaAccessLog);
		const columnNames = columns.map((c) => c.options?.name ?? c.propertyName);
		expect(columnNames).toEqual(
			expect.arrayContaining([
				'accessed_at',
				'id',
				'media_id',
				'accessor_id',
				'access_type',
				'ip_address',
				'user_agent',
			])
		);
	});
});

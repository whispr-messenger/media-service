import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaAccessLogsTable1742400000000 implements MigrationInterface {
	name = 'CreateMediaAccessLogsTable1742400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "media"."media_access_logs" (
				"accessed_at"  TIMESTAMPTZ   NOT NULL,
				"id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
				"media_id"     UUID          NOT NULL,
				"accessor_id"  UUID          NULL,
				"access_type"  VARCHAR(64)   NOT NULL,
				"ip_address"   VARCHAR(45)   NULL,
				"user_agent"   VARCHAR(512)  NULL,
				CONSTRAINT "PK_media_access_logs" PRIMARY KEY ("accessed_at", "id")
			) PARTITION BY RANGE ("accessed_at")
		`);

		await queryRunner.query(
			`CREATE INDEX "IDX_media_access_logs_media_id" ON "media"."media_access_logs" ("media_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_media_access_logs_accessor_id" ON "media"."media_access_logs" ("accessor_id") WHERE "accessor_id" IS NOT NULL`
		);

		await queryRunner.query(`
			CREATE TABLE "media"."media_access_logs_2026_03"
			PARTITION OF "media"."media_access_logs"
			FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')
		`);

		await queryRunner.query(`
			CREATE TABLE "media"."media_access_logs_2026_04"
			PARTITION OF "media"."media_access_logs"
			FOR VALUES FROM ('2026-04-01') TO ('2026-05-01')
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "media"."media_access_logs_2026_04"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "media"."media_access_logs_2026_03"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_access_logs_accessor_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_access_logs_media_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "media"."media_access_logs"`);
	}
}

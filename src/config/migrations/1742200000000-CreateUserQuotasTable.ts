import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserQuotasTable1742200000000 implements MigrationInterface {
	name = 'CreateUserQuotasTable1742200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "media"."user_quotas" (
				"id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
				"user_id"             UUID        NOT NULL,
				"storage_used"        BIGINT      NOT NULL DEFAULT 0,
				"storage_limit"       BIGINT      NOT NULL DEFAULT 1073741824,
				"files_count"         INTEGER     NOT NULL DEFAULT 0,
				"files_limit"         INTEGER     NOT NULL DEFAULT 1000,
				"daily_uploads"       INTEGER     NOT NULL DEFAULT 0,
				"daily_upload_limit"  INTEGER     NOT NULL DEFAULT 100,
				"quota_date"          DATE        NOT NULL,
				"updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
				CONSTRAINT "PK_user_quotas" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_user_quotas_user_id" ON "media"."user_quotas" ("user_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_user_quotas_quota_date" ON "media"."user_quotas" ("quota_date")`
		);

		await queryRunner.query(`
			CREATE TRIGGER "trg_user_quotas_updated_at"
			BEFORE UPDATE ON "media"."user_quotas"
			FOR EACH ROW EXECUTE FUNCTION "media".set_updated_at()
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TRIGGER IF EXISTS "trg_user_quotas_updated_at" ON "media"."user_quotas"`
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_user_quotas_quota_date"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_user_quotas_user_id"`);
		await queryRunner.query(`DROP TABLE "media"."user_quotas"`);
	}
}

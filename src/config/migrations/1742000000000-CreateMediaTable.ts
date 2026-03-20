import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaTable1742000000000 implements MigrationInterface {
	name = 'CreateMediaTable1742000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "media"`);

		await queryRunner.query(`
			CREATE TABLE "media"."media" (
				"id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
				"owner_id"       UUID          NOT NULL,
				"context"        VARCHAR(64)   NOT NULL,
				"storage_path"   VARCHAR(1024) NOT NULL,
				"thumbnail_path" VARCHAR(1024) NULL,
				"content_type"   VARCHAR(128)  NOT NULL,
				"blob_size"      BIGINT        NOT NULL,
				"expires_at"     TIMESTAMPTZ   NULL,
				"is_active"      BOOLEAN       NOT NULL DEFAULT TRUE,
				"created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
				"updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
				CONSTRAINT "PK_media" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`CREATE INDEX "IDX_media_owner_id" ON "media"."media" ("owner_id")`);
		await queryRunner.query(`CREATE INDEX "IDX_media_context" ON "media"."media" ("context")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_media_expires_at" ON "media"."media" ("expires_at") WHERE "expires_at" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_media_is_active" ON "media"."media" ("is_active") WHERE "is_active" = TRUE`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_media_owner_id_created_at" ON "media"."media" ("owner_id", "created_at" DESC)`
		);

		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION "media".set_updated_at()
			RETURNS TRIGGER AS $$
			BEGIN
				NEW."updated_at" = now();
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql
		`);

		await queryRunner.query(`
			CREATE TRIGGER "trg_media_updated_at"
			BEFORE UPDATE ON "media"."media"
			FOR EACH ROW EXECUTE FUNCTION "media".set_updated_at()
		`);

		await queryRunner.query(`ALTER TABLE "media"."media" ENABLE ROW LEVEL SECURITY`);

		await queryRunner.query(`
			CREATE POLICY "media_owner_policy" ON "media"."media"
			USING ("owner_id" = current_setting('app.current_user_id', TRUE)::UUID)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP POLICY IF EXISTS "media_owner_policy" ON "media"."media"`);
		await queryRunner.query(`ALTER TABLE "media"."media" DISABLE ROW LEVEL SECURITY`);
		await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_media_updated_at" ON "media"."media"`);
		await queryRunner.query(`DROP FUNCTION IF EXISTS "media".set_updated_at()`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_owner_id_created_at"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_is_active"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_expires_at"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_context"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_owner_id"`);
		await queryRunner.query(`DROP TABLE "media"."media"`);
	}
}

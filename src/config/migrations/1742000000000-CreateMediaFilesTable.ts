import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMediaFilesTable1742000000000 implements MigrationInterface {
	name = 'CreateMediaFilesTable1742000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "media"`);
		await queryRunner.query(`
			CREATE TYPE "media"."media_files_status_enum" AS ENUM ('active', 'deleted')
		`);
		await queryRunner.query(`
			CREATE TABLE "media"."media_files" (
				"id"           UUID        NOT NULL,
				"uploaderId"   UUID        NOT NULL,
				"filename"     VARCHAR(255) NOT NULL,
				"storageKey"   VARCHAR(512) NOT NULL,
				"mimeType"     VARCHAR(128) NOT NULL,
				"size"         BIGINT       NOT NULL,
				"status"       "media"."media_files_status_enum" NOT NULL DEFAULT 'active',
				"createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_media_files" PRIMARY KEY ("id")
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "media"."media_files"`);
		await queryRunner.query(`DROP TYPE "media"."media_files_status_enum"`);
	}
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationColumnsToMedia1743200000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE media.media ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(32) NOT NULL DEFAULT 'none'`
		);
		await queryRunner.query(`ALTER TABLE media.media ADD COLUMN IF NOT EXISTS moderation_score FLOAT`);
		await queryRunner.query(
			`ALTER TABLE media.media ADD COLUMN IF NOT EXISTS moderation_category VARCHAR(128)`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE media.media DROP COLUMN IF EXISTS moderation_category`);
		await queryRunner.query(`ALTER TABLE media.media DROP COLUMN IF EXISTS moderation_score`);
		await queryRunner.query(`ALTER TABLE media.media DROP COLUMN IF EXISTS moderation_status`);
	}
}

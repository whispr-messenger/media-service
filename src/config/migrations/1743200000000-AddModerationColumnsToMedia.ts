import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds moderation columns to the media table.
 *
 * These columns support content moderation for uploaded media:
 * - moderation_status: tracks the current moderation state
 * - moderation_score: confidence score from the moderation engine
 * - moderation_category: the category flagged by the moderation engine
 */
export class AddModerationColumnsToMedia1743200000000 implements MigrationInterface {
	name = 'AddModerationColumnsToMedia1743200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE media.media ADD COLUMN moderation_status VARCHAR(32) NOT NULL DEFAULT 'none'`
		);
		await queryRunner.query(`ALTER TABLE media.media ADD COLUMN moderation_score FLOAT`);
		await queryRunner.query(`ALTER TABLE media.media ADD COLUMN moderation_category VARCHAR(128)`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE media.media DROP COLUMN moderation_category`);
		await queryRunner.query(`ALTER TABLE media.media DROP COLUMN moderation_score`);
		await queryRunner.query(`ALTER TABLE media.media DROP COLUMN moderation_status`);
	}
}

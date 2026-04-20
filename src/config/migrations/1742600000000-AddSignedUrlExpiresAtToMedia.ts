import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignedUrlExpiresAtToMedia1742600000000 implements MigrationInterface {
	name = 'AddSignedUrlExpiresAtToMedia1742600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "media"."media" ADD COLUMN "signed_url_expires_at" TIMESTAMPTZ NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "media"."media" DROP COLUMN "signed_url_expires_at"`);
	}
}

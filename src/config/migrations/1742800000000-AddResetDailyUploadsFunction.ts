import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetDailyUploadsFunction1742800000000 implements MigrationInterface {
	name = 'AddResetDailyUploadsFunction1742800000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// SECURITY DEFINER makes this function execute with the privileges of its
		// owner (the migration role / table owner) rather than the calling role.
		// This allows the cron job to bypass the user_quotas RLS policy, which
		// requires app.current_user_id to be set — a GUC that is unavailable in a
		// background cron context.
		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION media.reset_daily_uploads()
			RETURNS TABLE(user_id UUID)
			LANGUAGE sql
			SECURITY DEFINER
			SET search_path = media
			AS $$
				UPDATE media.user_quotas
				SET
					daily_uploads = 0,
					quota_date    = CURRENT_DATE
				WHERE quota_date < CURRENT_DATE
				RETURNING user_quotas.user_id;
			$$
		`);

		// Restrict execution: SECURITY DEFINER functions are callable by PUBLIC
		// by default. Revoke that so only the function owner and explicitly
		// granted roles (e.g. the app/cron DB role) can invoke it.
		await queryRunner.query(`
			REVOKE EXECUTE ON FUNCTION media.reset_daily_uploads() FROM PUBLIC;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP FUNCTION IF EXISTS media.reset_daily_uploads()`);
	}
}

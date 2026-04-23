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
		// by default. Revoke that, then grant to whichever role(s) need it.
		await queryRunner.query(`
			REVOKE EXECUTE ON FUNCTION media.reset_daily_uploads() FROM PUBLIC;
		`);

		// Grant EXECUTE to the current (migration) role so the Vault-provisioned
		// user that runs this migration can also invoke the function from its
		// scheduled jobs. Works equally for a static `media_user` in local dev
		// or a dynamic `v-kubernet-role_med-...` name in staging/prod.
		await queryRunner.query(`
			GRANT EXECUTE ON FUNCTION media.reset_daily_uploads() TO CURRENT_USER;
		`);

		// WHISPR-1004: keep the legacy `media_user` grant when (and only when)
		// that role still exists — the local Docker init script provisions it,
		// but Vault-backed envs don't. Without the existence check the whole
		// migration crashes with `role "media_user" does not exist`.
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'media_user') THEN
					EXECUTE 'GRANT EXECUTE ON FUNCTION media.reset_daily_uploads() TO media_user';
				END IF;
			END
			$$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP FUNCTION IF EXISTS media.reset_daily_uploads()`);
	}
}

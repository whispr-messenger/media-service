import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a permissive RLS SELECT policy for public media contexts.
 *
 * Problem:
 *   The existing `media_owner_policy` was created without a FOR clause, which
 *   means it applies to ALL commands (SELECT, INSERT, UPDATE, DELETE).
 *   Its USING clause only allows rows where owner_id = current_user_id, which
 *   correctly restricts writes but also blocks non-owners from reading media
 *   with public contexts (AVATAR, GROUP_ICON).
 *
 * Fix:
 *   - Drop the overly broad policy.
 *   - Re-create it as FOR ALL (INSERT/UPDATE/DELETE) with owner-only USING.
 *   - Add a separate permissive SELECT policy that allows any authenticated
 *     session to read rows where context IN ('avatar', 'group_icon'), OR
 *     where the requester is the owner.
 *
 * This aligns the DB enforcement with MediaService.enforceReadAccess() which
 * already permits non-owner reads for public contexts at the service layer.
 */
export class AddPublicContextRlsSelectPolicy1743000000000 implements MigrationInterface {
	name = 'AddPublicContextRlsSelectPolicy1743000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Drop the existing catch-all policy so we can split it properly
		await queryRunner.query(`DROP POLICY IF EXISTS "media_owner_policy" ON "media"."media"`);

		// Restrictive owner policy for ALL write operations (INSERT/UPDATE/DELETE)
		// and for SELECT on private contexts
		await queryRunner.query(`
			CREATE POLICY "media_owner_write_policy" ON "media"."media"
			FOR ALL
			USING ("owner_id" = current_setting('app.current_user_id', TRUE)::UUID)
			WITH CHECK ("owner_id" = current_setting('app.current_user_id', TRUE)::UUID)
		`);

		// Permissive SELECT policy: any authenticated user can read public contexts,
		// or read their own rows regardless of context
		await queryRunner.query(`
			CREATE POLICY "media_public_context_select_policy" ON "media"."media"
			FOR SELECT
			USING (
				"context" IN ('avatar', 'group_icon')
				OR "owner_id" = current_setting('app.current_user_id', TRUE)::UUID
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP POLICY IF EXISTS "media_public_context_select_policy" ON "media"."media"`
		);
		await queryRunner.query(`DROP POLICY IF EXISTS "media_owner_write_policy" ON "media"."media"`);

		// Restore original catch-all owner policy
		await queryRunner.query(`
			CREATE POLICY "media_owner_policy" ON "media"."media"
			USING ("owner_id" = current_setting('app.current_user_id', TRUE)::UUID)
		`);
	}
}

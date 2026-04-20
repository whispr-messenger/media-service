import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute la colonne `shared_with` (UUID[]) et étend la politique RLS SELECT
 * pour autoriser les utilisateurs explicitement partagés à lire le média
 * (ex. membres de la conversation où un média MESSAGE est attaché).
 *
 * Avant ce correctif, seul le propriétaire (owner_id) ou les contextes
 * publics (avatar, group_icon) pouvaient lire un média : le destinataire
 * d'une image envoyée dans un chat recevait un 403 sur /media/v1/:id/blob
 * dès que l'URL présignée stockée dans le message expirait.
 */
export class AddSharedWithToMedia1743200000000 implements MigrationInterface {
	name = 'AddSharedWithToMedia1743200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "media"."media"
			ADD COLUMN IF NOT EXISTS "shared_with" UUID[] NULL
		`);

		// GIN index pour les lookups "current_user_id = ANY(shared_with)"
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_media_shared_with"
			ON "media"."media" USING GIN ("shared_with")
		`);

		// Étend la policy SELECT : autorise aussi ceux listés dans shared_with
		await queryRunner.query(
			`DROP POLICY IF EXISTS "media_public_context_select_policy" ON "media"."media"`
		);

		await queryRunner.query(`
			CREATE POLICY "media_public_context_select_policy" ON "media"."media"
			FOR SELECT
			USING (
				"context" IN ('avatar', 'group_icon')
				OR "owner_id" = current_setting('app.current_user_id', TRUE)::UUID
				OR (
					"shared_with" IS NOT NULL
					AND current_setting('app.current_user_id', TRUE)::UUID = ANY("shared_with")
				)
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restaure la policy précédente (sans shared_with)
		await queryRunner.query(
			`DROP POLICY IF EXISTS "media_public_context_select_policy" ON "media"."media"`
		);

		await queryRunner.query(`
			CREATE POLICY "media_public_context_select_policy" ON "media"."media"
			FOR SELECT
			USING (
				"context" IN ('avatar', 'group_icon')
				OR "owner_id" = current_setting('app.current_user_id', TRUE)::UUID
			)
		`);

		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_shared_with"`);
		await queryRunner.query(`ALTER TABLE "media"."media" DROP COLUMN IF EXISTS "shared_with"`);
	}
}

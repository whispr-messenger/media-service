import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute la colonne `conversation_id` (UUID, nullable) sur les médias et
 * étend la politique RLS SELECT pour rendre visibles les médias rattachés à
 * une conversation.
 *
 * Contexte : `shared_with` est un snapshot figé des membres AU MOMENT de
 * l'upload. Un utilisateur qui REJOINT le groupe ensuite n'y figure pas et
 * recevait un 403 sur `/media/v1/:id/blob` et `/thumbnail`.
 *
 * Correctif (option A — autorisation par membership) : on persiste la
 * conversation cible sur le média, et `MediaService.enforceReadAccess`
 * vérifie en live, via messaging-service, que le demandeur est un membre
 * COURANT de cette conversation. La RLS doit donc laisser la ligne VISIBLE
 * pour que ce contrôle applicatif (qui reste la porte d'autorisation
 * faisant autorité) puisse s'exécuter — sinon la ligne est masquée et le
 * `findById` renvoie null (404) avant tout check de membership.
 *
 * Sécurité : la RLS n'est qu'un filet de défense en profondeur ; la
 * délivrance effective (URL présignée / octets) reste gardée au niveau
 * applicatif par `enforceReadAccess` (owner OU shared_with OU membre
 * courant). Rendre la ligne visible n'expose pas le blob.
 */
export class AddConversationIdToMedia1743400000000 implements MigrationInterface {
	name = 'AddConversationIdToMedia1743400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "media"."media"
			ADD COLUMN IF NOT EXISTS "conversation_id" UUID NULL
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_media_conversation_id"
			ON "media"."media" ("conversation_id")
			WHERE "conversation_id" IS NOT NULL
		`);

		// Étend la policy SELECT : rend aussi visibles les médias rattachés à
		// une conversation. L'autorisation fine (membre courant) est ensuite
		// appliquée côté applicatif par enforceReadAccess.
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
				OR "conversation_id" IS NOT NULL
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restaure la policy sans la branche conversation_id.
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

		await queryRunner.query(`DROP INDEX IF EXISTS "media"."IDX_media_conversation_id"`);
		await queryRunner.query(`ALTER TABLE "media"."media" DROP COLUMN IF EXISTS "conversation_id"`);
	}
}

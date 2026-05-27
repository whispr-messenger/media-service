import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

// TTL du cache e2ee-status : 60s pour eviter de spammer messaging-service
// tout en restant coherent avec les toggles recents de l'utilisateur.
const E2EE_STATUS_CACHE_TTL_MS = 60_000;

interface E2eeStatusResponse {
	conversation_id: string;
	e2ee_enabled: boolean;
}

/**
 * Client HTTP interne vers messaging-service.
 *
 * Interroge GET /messaging/api/v1/internal/conversations/:id/e2ee-status
 * pour savoir si une conversation a E2EE active. Resultat cache 60s.
 *
 * Comportement fail-open : si messaging-service est injoignable ou retourne
 * une erreur non-404, on laisse passer l'upload plutot que de bloquer
 * l'utilisateur. Seul le cas "conv E2EE confirmee + plaintext" est refuse.
 */
@Injectable()
export class MessagingService {
	private readonly logger = new Logger(MessagingService.name);
	private readonly baseUrl: string;
	private readonly internalToken: string | undefined;
	private readonly timeoutMs: number;

	constructor(
		private readonly configService: ConfigService,
		@Inject(CACHE_MANAGER) private readonly cache: Cache
	) {
		this.baseUrl = (this.configService.get<string>('MESSAGING_SERVICE_URL') ?? '').replace(/\/$/, '');
		this.internalToken = this.configService.get<string>('INTERNAL_API_TOKEN');
		this.timeoutMs = this.configService.get<number>('MESSAGING_SERVICE_TIMEOUT_MS', 3000);
	}

	/**
	 * Retourne true si la conversation a E2EE active, false sinon.
	 * Resultat mis en cache 60s.
	 *
	 * En cas d'erreur reseau ou service indisponible : retourne false (fail-open).
	 * En cas de conv inexistante (404) : retourne false.
	 */
	async isConversationE2EE(conversationId: string): Promise<boolean> {
		const cacheKey = `e2ee:conv:${conversationId}`;
		const cached = await this.cache.get<boolean>(cacheKey);
		if (cached !== undefined && cached !== null) {
			return cached;
		}

		const result = await this.fetchE2eeStatus(conversationId);
		// On cache meme les false pour eviter les requetes repetees
		await this.cache.set(cacheKey, result, E2EE_STATUS_CACHE_TTL_MS);
		return result;
	}

	private async fetchE2eeStatus(conversationId: string): Promise<boolean> {
		if (!this.baseUrl) {
			this.logger.warn('MESSAGING_SERVICE_URL non configure - e2ee-status non verifiable (fail-open)');
			return false;
		}

		const url = `${this.baseUrl}/messaging/api/v1/internal/conversations/${encodeURIComponent(conversationId)}/e2ee-status`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (this.internalToken) {
			headers['x-internal-token'] = this.internalToken;
		}

		const controller = new AbortController();
		const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await fetch(url, { headers, signal: controller.signal });

			if (response.status === 404) {
				// Conv inconnue ou endpoint non expose : fail-open
				return false;
			}

			if (!response.ok) {
				this.logger.warn(
					`messaging-service e2ee-status HTTP ${response.status} pour conv ${conversationId} - fail-open`
				);
				return false;
			}

			const body = (await response.json()) as E2eeStatusResponse;
			return body.e2ee_enabled === true;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.logger.warn(
				`messaging-service injoignable (${msg}) - fail-open pour conv ${conversationId}`
			);
			return false;
		} finally {
			globalThis.clearTimeout(timer);
		}
	}
}

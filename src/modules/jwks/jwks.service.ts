import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, KeyObject } from 'node:crypto';

const FETCH_TIMEOUT_MS = 5000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;
const BACKOFF_MAX_ATTEMPTS = 10;

interface JwkKey {
	kty: string;
	use?: string;
	alg?: string;
	crv?: string;
	x?: string;
	y?: string;
}

interface JwksDocument {
	keys: JwkKey[];
}

@Injectable()
export class JwksService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(JwksService.name);
	private publicKey: KeyObject | null = null;
	private _destroyed = false;
	private _sleepHandle: NodeJS.Timeout | null = null;

	constructor(private readonly configService: ConfigService) {}

	async onModuleInit(): Promise<void> {
		void this.loadPublicKeyWithRetry();
	}

	onModuleDestroy(): void {
		this._destroyed = true;
		if (this._sleepHandle !== null) {
			globalThis.clearTimeout(this._sleepHandle);
			this._sleepHandle = null;
		}
	}

	private async loadPublicKeyWithRetry(): Promise<void> {
		let delay = BACKOFF_INITIAL_MS;

		for (let attempt = 1; attempt <= BACKOFF_MAX_ATTEMPTS; attempt++) {
			if (this._destroyed) return;

			try {
				await this.loadPublicKey();
				return;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.error(
					`Failed to load ES256 public key (attempt ${attempt}/${BACKOFF_MAX_ATTEMPTS}): ${message}`
				);
			}

			if (attempt < BACKOFF_MAX_ATTEMPTS) {
				this.logger.warn(`Retrying JWKS fetch in ${delay}ms…`);
				await this.sleep(delay);
				delay = Math.min(delay * 2, BACKOFF_CAP_MS);
			}
		}

		this.logger.error(
			`ES256 public key could not be loaded after ${BACKOFF_MAX_ATTEMPTS} attempts. Continuing background retries every ${BACKOFF_CAP_MS}ms.`
		);

		void this.continueBackgroundRetry();
	}

	private async continueBackgroundRetry(): Promise<void> {
		while (!this.publicKey && !this._destroyed) {
			await this.sleep(BACKOFF_CAP_MS);

			if (this._destroyed) return;

			try {
				await this.loadPublicKey();
				this.logger.log('ES256 public key loaded successfully (background retry).');
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.error(`Background JWKS reload failed: ${message}`);
			}
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			const handle = globalThis.setTimeout(resolve, ms);
			if (typeof handle === 'object' && 'unref' in handle) {
				(handle as NodeJS.Timeout).unref();
			}
			this._sleepHandle = handle as NodeJS.Timeout;
		});
	}

	async loadPublicKey(): Promise<void> {
		const jwksUri = this.configService.getOrThrow<string>('JWT_JWKS_URL');

		const controller = new AbortController();
		const timeout = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		let response: Response;
		try {
			response = await fetch(jwksUri, { signal: controller.signal });
		} catch (error) {
			const reason =
				error.name === 'AbortError' ? `timed out after ${FETCH_TIMEOUT_MS}ms` : error.message;
			this.logger.error(`Failed to fetch JWKS: ${reason}`);
			throw new Error(`JWKS fetch failed: ${reason}`);
		} finally {
			globalThis.clearTimeout(timeout);
		}

		if (!response.ok) {
			throw new Error(`JWKS endpoint returned HTTP ${response.status}`);
		}

		let document: JwksDocument;
		try {
			document = (await response.json()) as JwksDocument;
		} catch (error) {
			throw new Error(`Failed to parse JWKS response: ${error.message}`);
		}

		const ecKey = document.keys?.find(
			(k) => k.kty === 'EC' && k.crv === 'P-256' && (k.use === 'sig' || k.alg === 'ES256')
		);
		if (!ecKey) {
			throw new Error('No ES256 (EC P-256) key found in JWKS document');
		}

		if (!ecKey.x || !ecKey.y) {
			throw new Error('ES256 (EC P-256) key in JWKS is missing required coordinates (x/y)');
		}

		try {
			this.publicKey = createPublicKey({ key: ecKey as unknown as JsonWebKey, format: 'jwk' });
		} catch (error) {
			throw new Error(`Failed to import EC public key: ${error.message}`);
		}

		this.logger.log('ES256 public key loaded successfully from JWKS');
	}

	getPublicKey(): KeyObject | null {
		return this.publicKey;
	}

	getPublicKeyPem(): string | null {
		if (!this.publicKey) return null;
		return this.publicKey.export({ type: 'spki', format: 'pem' }) as string;
	}

	isReady(): boolean {
		return this.publicKey !== null;
	}
}

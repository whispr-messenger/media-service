import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, KeyObject } from 'crypto';

const FETCH_TIMEOUT_MS = 5000;

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
export class JwksService implements OnModuleInit {
	private readonly logger = new Logger(JwksService.name);
	private publicKey: KeyObject | null = null;

	constructor(private readonly configService: ConfigService) {}

	async onModuleInit(): Promise<void> {
		try {
			await this.loadPublicKey();
		} catch (error) {
			this.logger.error(`Failed to load ES256 public key at startup: ${error.message}`);
		}
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

	isReady(): boolean {
		return this.publicKey !== null;
	}
}

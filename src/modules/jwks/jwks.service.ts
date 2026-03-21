import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, KeyObject } from 'crypto';

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
		await this.loadPublicKey();
	}

	async loadPublicKey(): Promise<void> {
		const jwksUri = this.configService.getOrThrow<string>('JWT_JWKS_URL');

		let response: Response;
		try {
			response = await fetch(jwksUri);
		} catch (error) {
			this.logger.error(`Failed to fetch JWKS from ${jwksUri}: ${error.message}`);
			throw new Error(`JWKS fetch failed: ${error.message}`);
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

		const ecKey = document.keys?.find((k) => k.kty === 'EC' && k.crv === 'P-256');
		if (!ecKey) {
			throw new Error('No ES256 (EC P-256) key found in JWKS document');
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

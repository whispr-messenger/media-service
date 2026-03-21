import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectS3, S3 } from 'nestjs-s3';
import {
	GetBucketLifecycleConfigurationCommand,
	PutBucketLifecycleConfigurationCommand,
	LifecycleRule,
	LifecycleExpiration,
} from '@aws-sdk/client-s3';

/**
 * Configures S3/MinIO lifecycle policies for automatic blob expiration.
 *
 * Rules are applied at application startup only if they are not already
 * present (idempotent). Two prefixes are covered:
 *
 * - `messages/`  — per-message blobs; TTL driven by MESSAGE_BLOB_TTL_DAYS
 *                  (default: 30 days after the object's LastModified date)
 * - `thumbnails/` — same TTL as messages
 *
 * MinIO supports lifecycle policies via the AWS S3-compatible API, so no
 * additional Helm or MinIO configuration is required beyond enabling the
 * `mc ilm` feature (which is on by default for MinIO >= 2021-09).
 */
@Injectable()
export class LifecycleService implements OnApplicationBootstrap {
	private readonly logger = new Logger(LifecycleService.name);
	private readonly bucket: string;
	private readonly messageBlobTtlDays: number;

	constructor(
		@InjectS3() private readonly s3: S3,
		private readonly configService: ConfigService
	) {
		this.bucket = this.configService.get<string>('S3_BUCKET', 'whispr-media');
		this.messageBlobTtlDays = this.configService.get<number>('MESSAGE_BLOB_TTL_DAYS', 30);
	}

	async onApplicationBootstrap(): Promise<void> {
		try {
			await this.ensureLifecyclePolicies();
		} catch (error) {
			// Non-fatal: lifecycle policies are best-effort at startup.
			this.logger.warn(`Failed to configure S3 lifecycle policies: ${(error as Error).message}`);
		}
	}

	async ensureLifecyclePolicies(): Promise<void> {
		const desiredRuleIds = new Set(['messages-expiry', 'thumbnails-expiry']);

		// Fetch existing rules (if any)
		let existingRules: LifecycleRule[] = [];
		try {
			const response = await this.s3.send(
				new GetBucketLifecycleConfigurationCommand({ Bucket: this.bucket })
			);
			existingRules = response.Rules ?? [];
		} catch (error) {
			// NoSuchLifecycleConfiguration is expected when no rules exist yet
			if ((error as { name?: string }).name !== 'NoSuchLifecycleConfiguration') {
				throw error;
			}
		}

		const existingIds = new Set(existingRules.map((r) => r.ID ?? ''));
		const allPresent = [...desiredRuleIds].every((id) => existingIds.has(id));

		if (allPresent) {
			this.logger.log('S3 lifecycle policies already configured — skipping');
			return;
		}

		// Merge: keep existing rules that are not ours, then add/replace ours
		const otherRules = existingRules.filter((r) => !desiredRuleIds.has(r.ID ?? ''));

		const expiration: LifecycleExpiration = { Days: this.messageBlobTtlDays };

		const newRules: LifecycleRule[] = [
			...otherRules,
			{
				ID: 'messages-expiry',
				Status: 'Enabled',
				Filter: { Prefix: 'messages/' },
				Expiration: expiration,
			},
			{
				ID: 'thumbnails-expiry',
				Status: 'Enabled',
				Filter: { Prefix: 'thumbnails/' },
				Expiration: expiration,
			},
		];

		await this.s3.send(
			new PutBucketLifecycleConfigurationCommand({
				Bucket: this.bucket,
				LifecycleConfiguration: { Rules: newRules },
			})
		);

		this.logger.log(
			`S3 lifecycle policies applied: messages/ and thumbnails/ expire after ` +
				`${this.messageBlobTtlDays} days`
		);
	}
}

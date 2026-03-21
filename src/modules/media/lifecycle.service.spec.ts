import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getS3ConnectionToken } from 'nestjs-s3';
import { LifecycleService } from './lifecycle.service';

const mockS3 = { send: jest.fn() };
const mockConfigService = {
	get: jest.fn((key: string, def?: unknown) => {
		if (key === 'S3_BUCKET') return 'whispr-media';
		if (key === 'MESSAGE_BLOB_TTL_DAYS') return 30;
		return def;
	}),
};

describe('LifecycleService', () => {
	let service: LifecycleService;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LifecycleService,
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: getS3ConnectionToken('default'), useValue: mockS3 },
			],
		}).compile();

		service = module.get(LifecycleService);
	});

	it('applies lifecycle rules when none exist yet', async () => {
		// Simulate NoSuchLifecycleConfiguration on first GET
		mockS3.send.mockRejectedValueOnce(
			Object.assign(new Error('no config'), { name: 'NoSuchLifecycleConfiguration' })
		);
		mockS3.send.mockResolvedValueOnce({});

		await service.ensureLifecyclePolicies();

		expect(mockS3.send).toHaveBeenCalledTimes(2);
		const putCall = mockS3.send.mock.calls[1][0];
		const rules: Array<{ ID: string; Expiration: { Days: number } }> =
			putCall.input.LifecycleConfiguration.Rules;
		const ids = rules.map((r) => r.ID);
		expect(ids).toContain('messages-expiry');
		expect(ids).toContain('thumbnails-expiry');
		rules.forEach((r) => {
			if (r.ID === 'messages-expiry' || r.ID === 'thumbnails-expiry') {
				expect(r.Expiration.Days).toBe(30);
			}
		});
	});

	it('skips PUT when both rules already exist', async () => {
		mockS3.send.mockResolvedValueOnce({
			Rules: [
				{ ID: 'messages-expiry', Status: 'Enabled' },
				{ ID: 'thumbnails-expiry', Status: 'Enabled' },
			],
		});

		await service.ensureLifecyclePolicies();

		expect(mockS3.send).toHaveBeenCalledTimes(1);
	});

	it('re-applies rules when only one is present', async () => {
		mockS3.send.mockResolvedValueOnce({
			Rules: [{ ID: 'messages-expiry', Status: 'Enabled' }],
		});
		mockS3.send.mockResolvedValueOnce({});

		await service.ensureLifecyclePolicies();

		expect(mockS3.send).toHaveBeenCalledTimes(2);
	});

	it('does not throw when ensureLifecyclePolicies fails — onApplicationBootstrap catches it', async () => {
		mockS3.send.mockRejectedValue(new Error('S3 error'));

		await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
	});
});

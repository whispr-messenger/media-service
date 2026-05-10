import { ConfigService } from '@nestjs/config';
import { GroupService } from './group.service';

describe('GroupService', () => {
	let originalFetch: typeof globalThis.fetch;

	const buildService = (overrides: Record<string, unknown> = {}): GroupService => {
		const config: Record<string, unknown> = {
			GROUP_SERVICE_URL: 'http://group-service:3000/',
			GROUP_SERVICE_TIMEOUT_MS: 1500,
			...overrides,
		};
		const configService = {
			get: jest.fn((key: string, fallback?: unknown) =>
				config[key] !== undefined ? config[key] : fallback
			),
		} as unknown as ConfigService;
		return new GroupService(configService);
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it('strips a trailing slash from the configured base url', () => {
		const service = buildService({ GROUP_SERVICE_URL: 'http://group-service:3000/' });
		expect((service as unknown as { baseUrl: string }).baseUrl).toBe('http://group-service:3000');
	});

	it('throws when GROUP_SERVICE_URL is not configured', async () => {
		const service = buildService({ GROUP_SERVICE_URL: '' });
		await expect(service.isAdmin('group-1')).rejects.toThrow('GROUP_SERVICE_URL is not configured');
	});

	it('returns false when group-service responds 404', async () => {
		const fetchMock = jest.fn().mockResolvedValue({ status: 404, ok: false });
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).resolves.toBe(false);
		expect(fetchMock).toHaveBeenCalledWith(
			'http://group-service:3000/groups/v1/group-1/members',
			expect.objectContaining({
				headers: expect.objectContaining({ Accept: 'application/json' }),
			})
		);
	});

	it('returns false when group-service responds 403', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 403,
			ok: false,
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).resolves.toBe(false);
	});

	it('throws when the response is not ok and not 403/404', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 500,
			ok: false,
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).rejects.toThrow('group-service returned HTTP 500');
	});

	it('returns true when the user is admin and members are wrapped in a members property', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => ({
				members: [
					{ userId: 'someone-else', role: 'admin' },
					{ userId: 'group-1', role: 'admin' },
				],
			}),
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).resolves.toBe(true);
	});

	it('returns true when the body is a bare members array and the user is admin', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => [{ userId: 'group-1', role: 'admin' }],
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).resolves.toBe(true);
	});

	it('returns false when the user is a non-admin member', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => ({ members: [{ userId: 'group-1', role: 'member' }] }),
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).resolves.toBe(false);
	});

	it('returns false when the body is missing a members field', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => ({}),
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).resolves.toBe(false);
	});

	it('passes a Bearer auth token when configured', async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => ({ members: [] }),
		});
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const service = buildService({ GROUP_SERVICE_AUTH_TOKEN: 'top-secret' });
		await service.isAdmin('group-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://group-service:3000/groups/v1/group-1/members',
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: 'application/json',
					Authorization: 'Bearer top-secret',
				}),
			})
		);
	});

	it('url-encodes the group id in the path', async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => ({ members: [] }),
		});
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

		const service = buildService();
		await service.isAdmin('group with spaces/and slashes');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://group-service:3000/groups/v1/group%20with%20spaces%2Fand%20slashes/members',
			expect.any(Object)
		);
	});

	it('clears the abort timer when the response resolves', async () => {
		const clearSpy = jest.spyOn(globalThis, 'clearTimeout');
		globalThis.fetch = jest.fn().mockResolvedValue({
			status: 200,
			ok: true,
			json: async () => ({ members: [] }),
		}) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await service.isAdmin('group-1');
		expect(clearSpy).toHaveBeenCalled();
	});

	it('clears the abort timer even when fetch rejects', async () => {
		const clearSpy = jest.spyOn(globalThis, 'clearTimeout');
		globalThis.fetch = jest
			.fn()
			.mockRejectedValue(new Error('network down')) as unknown as typeof globalThis.fetch;

		const service = buildService();
		await expect(service.isAdmin('group-1')).rejects.toThrow('network down');
		expect(clearSpy).toHaveBeenCalled();
	});
});

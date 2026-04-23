import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GroupMember {
	userId: string;
	role: string;
}

/**
 * Client for group-service. Returns whether the caller is authorized to
 * act as an admin for a given id. Returns false uniformly for non-admin,
 * non-member, and unknown-group cases so the transport status cannot be
 * used to probe group existence. Network faults / 5xx propagate as thrown
 * errors so the caller can return 503.
 */
@Injectable()
export class GroupService {
	private readonly logger = new Logger(GroupService.name);
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly authToken: string | undefined;

	constructor(private readonly configService: ConfigService) {
		this.baseUrl = (this.configService.get<string>('GROUP_SERVICE_URL') ?? '').replace(/\/$/, '');
		this.timeoutMs = this.configService.get<number>('GROUP_SERVICE_TIMEOUT_MS', 3000);
		this.authToken = this.configService.get<string>('GROUP_SERVICE_AUTH_TOKEN');
	}

	async isAdmin(id: string): Promise<boolean> {
		if (!this.baseUrl) {
			throw new Error('GROUP_SERVICE_URL is not configured');
		}

		const url = `${this.baseUrl}/groups/v1/${encodeURIComponent(id)}/members`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (this.authToken) headers.Authorization = `Bearer ${this.authToken}`;

		const controller = new AbortController();
		const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
		let response: Response;
		try {
			response = await fetch(url, { headers, signal: controller.signal });
		} finally {
			globalThis.clearTimeout(timer);
		}

		if (response.status === 404 || response.status === 403) return false;
		if (!response.ok) {
			throw new Error(`group-service returned HTTP ${response.status}`);
		}

		const body = (await response.json()) as { members?: GroupMember[] } | GroupMember[];
		const members: GroupMember[] = Array.isArray(body) ? body : (body.members ?? []);
		return members.some((m) => m.role === 'admin' && m.userId === id);
	}
}

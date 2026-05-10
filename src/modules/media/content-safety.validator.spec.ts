import { PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import * as sharp from 'sharp';
import { checkImageDimensions, checkPdfJavaScript, checkClamAv } from './content-safety.validator';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Génère un buffer PNG minimal pour un test de dimensions. */
async function makePng(width: number, height: number): Promise<Buffer> {
	return sharp({
		create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
	})
		.png()
		.toBuffer();
}

/** Buffer PDF minimaliste sans JavaScript. */
function makePdfClean(): Buffer {
	return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
}

/** Buffer PDF avec un token /JavaScript embarqué. */
function makePdfWithJs(): Buffer {
	return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Names << /JavaScript 2 0 R >> >>\nendobj\n');
}

// ── checkImageDimensions() ───────────────────────────────────────────────────

describe('checkImageDimensions()', () => {
	it('passe pour une image dans les limites (200x200)', async () => {
		const buf = await makePng(200, 200);
		await expect(checkImageDimensions(buf, 'image/png')).resolves.toBeUndefined();
	});

	it('rejette une image trop grande (>50 MP)', async () => {
		// 7071 x 7072 ≈ 50 003 312 px > 50 000 000
		const buf = await makePng(7072, 7072);
		await expect(checkImageDimensions(buf, 'image/png')).rejects.toThrow(PayloadTooLargeException);
	});

	it('ne touche pas aux types non-image (application/pdf)', async () => {
		await expect(checkImageDimensions(makePdfClean(), 'application/pdf')).resolves.toBeUndefined();
	});

	it('ne touche pas aux types non-image (video/mp4)', async () => {
		await expect(checkImageDimensions(Buffer.alloc(32), 'video/mp4')).resolves.toBeUndefined();
	});

	it('fail-open si sharp ne peut pas décoder le buffer (format inconnu)', async () => {
		// Buffer aléatoire qui ne correspond à aucun format image
		const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xde, 0xad, 0xbe, 0xef]);
		await expect(checkImageDimensions(garbage, 'image/jpeg')).resolves.toBeUndefined();
	});
});

// ── checkPdfJavaScript() ─────────────────────────────────────────────────────

describe('checkPdfJavaScript()', () => {
	it('passe pour un PDF propre', () => {
		expect(() => checkPdfJavaScript(makePdfClean(), 'application/pdf')).not.toThrow();
	});

	it('rejette un PDF avec /JavaScript', () => {
		expect(() => checkPdfJavaScript(makePdfWithJs(), 'application/pdf')).toThrow(
			UnprocessableEntityException
		);
	});

	it("rejette un PDF avec /JS suivi d'espace", () => {
		const buf = Buffer.from('%PDF-1.4\n<</JS (alert(1))>>');
		expect(() => checkPdfJavaScript(buf, 'application/pdf')).toThrow(UnprocessableEntityException);
	});

	it('ne touche pas aux types non-PDF (image/jpeg)', () => {
		// même buffer qui contiendrait /JavaScript ne doit pas lever d'exception
		const buf = Buffer.from('/JavaScript dans une image bidon');
		expect(() => checkPdfJavaScript(buf, 'image/jpeg')).not.toThrow();
	});

	it('ne touche pas aux types non-PDF (application/zip)', () => {
		const buf = Buffer.from('/JavaScript dans un zip bidon');
		expect(() => checkPdfJavaScript(buf, 'application/zip')).not.toThrow();
	});
});

// ── checkClamAv() ────────────────────────────────────────────────────────────

// Fabrique un mock de net.Socket qui simule une réponse clamd configurable.
// Les événements sont émis de façon asynchrone (globalThis.setImmediate) pour laisser
// le code enregistrer ses listeners avant que les données arrivent.
function makeMockSocket(response: string, errorAfterConnect?: Error) {
	const listeners: Record<string, ((...args: any[]) => void)[]> = {};

	const socket = {
		setTimeout: jest.fn(),
		connect: jest.fn((_port: number, _host: string, cb: () => void) => {
			globalThis.setImmediate(() => {
				if (errorAfterConnect) {
					(listeners['error'] ?? []).forEach((fn) => fn(errorAfterConnect));
					return;
				}
				cb();
				// Simule la réponse du daemon puis la fin de connexion
				globalThis.setImmediate(() => {
					(listeners['data'] ?? []).forEach((fn) => fn(Buffer.from(response)));
					globalThis.setImmediate(() => {
						(listeners['end'] ?? []).forEach((fn) => fn());
					});
				});
			});
		}),
		write: jest.fn(),
		destroy: jest.fn(),
		on: jest.fn((event: string, fn: (...args: any[]) => void) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(fn);
			return socket;
		}),
	};
	return socket;
}

describe('checkClamAv()', () => {
	const originalEnv = { host: process.env.CLAMAV_HOST, port: process.env.CLAMAV_PORT };

	beforeEach(() => {
		delete process.env.CLAMAV_HOST;
		delete process.env.CLAMAV_PORT;
	});

	afterEach(() => {
		if (originalEnv.host === undefined) delete process.env.CLAMAV_HOST;
		else process.env.CLAMAV_HOST = originalEnv.host;
		if (originalEnv.port === undefined) delete process.env.CLAMAV_PORT;
		else process.env.CLAMAV_PORT = originalEnv.port;
		jest.restoreAllMocks();
	});

	it("fail-open si CLAMAV_HOST n'est pas défini", async () => {
		// aucune connexion réseau tentée, aucune exception
		await expect(checkClamAv(Buffer.from('payload'))).resolves.toBeUndefined();
	});

	it('fail-open si le daemon est inaccessible (port fermé)', async () => {
		// Port 1 est réservé et presque jamais ouvert : la connexion échoue rapidement
		process.env.CLAMAV_HOST = '127.0.0.1';
		process.env.CLAMAV_PORT = '1';
		// Ne doit pas rejeter même si la connexion échoue
		await expect(checkClamAv(Buffer.from('payload'))).resolves.toBeUndefined();
	});

	it('passe sans exception quand clamd répond OK (fichier sain)', async () => {
		process.env.CLAMAV_HOST = '127.0.0.1';
		process.env.CLAMAV_PORT = '3310';

		const mockSocket = makeMockSocket('stream: OK');
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		jest.spyOn(require('net'), 'Socket').mockImplementation(() => mockSocket as any);

		await expect(checkClamAv(Buffer.from('clean'))).resolves.toBeUndefined();
	});

	it('lève UnprocessableEntityException quand clamd répond FOUND (malware détecté)', async () => {
		process.env.CLAMAV_HOST = '127.0.0.1';
		process.env.CLAMAV_PORT = '3310';

		const mockSocket = makeMockSocket('stream: Eicar-Test-Signature FOUND');
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		jest.spyOn(require('net'), 'Socket').mockImplementation(() => mockSocket as any);

		await expect(checkClamAv(Buffer.from('eicar'))).rejects.toThrow(UnprocessableEntityException);
	});

	it('fail-open quand la connexion TCP aboutit mais le daemon renvoie une réponse inattendue', async () => {
		process.env.CLAMAV_HOST = '127.0.0.1';
		process.env.CLAMAV_PORT = '3310';

		const mockSocket = makeMockSocket('stream: PARSE ERROR');
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		jest.spyOn(require('net'), 'Socket').mockImplementation(() => mockSocket as any);

		// Réponse inattendue → warn log mais pas d'exception (fail-open)
		await expect(checkClamAv(Buffer.from('unknown'))).resolves.toBeUndefined();
	});
});

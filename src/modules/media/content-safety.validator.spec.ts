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

describe('checkClamAv()', () => {
	const originalEnv = process.env.CLAMAV_HOST;

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.CLAMAV_HOST;
		} else {
			process.env.CLAMAV_HOST = originalEnv;
		}
	});

	it("fail-open si CLAMAV_HOST n'est pas défini", async () => {
		delete process.env.CLAMAV_HOST;
		// aucune connexion réseau tentée, aucune exception
		await expect(checkClamAv(Buffer.from('payload'))).resolves.toBeUndefined();
	});

	it('fail-open si le daemon est inaccessible (port fermé)', async () => {
		// Port 1 est réservé et presque jamais ouvert : la connexion échoue rapidement
		process.env.CLAMAV_HOST = '127.0.0.1';
		process.env.CLAMAV_PORT = '1';
		// Ne doit pas rejeter même si la connexion échoue
		await expect(checkClamAv(Buffer.from('payload'))).resolves.toBeUndefined();
		delete process.env.CLAMAV_PORT;
	});
});

import { Logger, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import * as sharp from 'sharp';
import * as net from 'net';

const logger = new Logger('ContentSafetyValidator');

// 50 Megapixels - un décodage complet au-delà de cette limite peut saturer le heap du pod
// (ex. image 10000x5000 = 50MP, ~200MB en RGBA non-compressé → risque OOM/DoS)
const MAX_PIXELS = 50_000_000;

// Tokens PDF qui signalent du JavaScript embarqué (cf. spec ISO 32000-1 §12.6.4)
// On scanne les 64 KB initiaux : les headers /JS apparaissent quasi-toujours dans le catalog
const PDF_JS_SCAN_BYTES = 64 * 1024;
const PDF_JS_TOKENS = ['/JS ', '/JavaScript', '/JS\r', '/JS\n', '/JS(', '/JS<'];

// Types d'images supportés par sharp - les autres MIME (pdf, video, audio, zip) sont ignorés
const IMAGE_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/heic',
	'image/heif',
]);

/**
 * Vérifie les dimensions d'une image AVANT décodage complet via sharp.metadata().
 * Rejette si width * height > MAX_PIXELS (50 MP) pour bloquer les image bombs.
 * Ne lance pas d'exception pour les types non-image (pdf, vidéo, etc.).
 */
export async function checkImageDimensions(buffer: Buffer, mimeType: string): Promise<void> {
	const mime = mimeType.split(';')[0].trim().toLowerCase();
	if (!IMAGE_MIME_TYPES.has(mime)) return;

	let metadata: sharp.Metadata;
	try {
		metadata = await sharp(buffer, { failOn: 'none' }).metadata();
	} catch (err) {
		// sharp ne peut pas lire le format : on laisse passer, la validation
		// magic-bytes plus haut a déjà confirmé la signature binaire
		logger.warn(
			`sharp.metadata() failed for mime=${mime}: ${err instanceof Error ? err.message : String(err)}`
		);
		return;
	}

	const { width, height } = metadata;
	if (width === undefined || height === undefined) return;

	const pixels = width * height;
	if (pixels > MAX_PIXELS) {
		throw new PayloadTooLargeException(
			`Image dimensions ${width}x${height} (${pixels} px) exceed the ${MAX_PIXELS} px limit`
		);
	}
}

/**
 * Détecte la présence de JavaScript embarqué dans un PDF.
 * Lit uniquement les premiers PDF_JS_SCAN_BYTES pour éviter de charger un PDF entier en mémoire.
 * Rejette avec 422 si un token /JS ou /JavaScript est trouvé.
 * Ne fait rien pour les types non-PDF.
 */
export function checkPdfJavaScript(buffer: Buffer, mimeType: string): void {
	const mime = mimeType.split(';')[0].trim().toLowerCase();
	if (mime !== 'application/pdf') return;

	const slice = buffer.subarray(0, PDF_JS_SCAN_BYTES).toString('latin1');
	for (const token of PDF_JS_TOKENS) {
		if (slice.includes(token)) {
			throw new UnprocessableEntityException('PDF contains embedded JavaScript which is not permitted');
		}
	}
}

/**
 * Stub ClamAV : se branche sur un daemon ClamAV si CLAMAV_HOST est défini.
 * Si indisponible ou non configuré, fail-open avec un log warn (on ne bloque pas l'upload).
 * Utilise le protocole INSTREAM de clamd (RFC-like) via une connexion TCP nue.
 *
 * Pour déployer : lancer clamd dans le même pod ou en sidecar, définir CLAMAV_HOST=127.0.0.1
 * et CLAMAV_PORT=3310 (défaut clamd).
 */
export async function checkClamAv(buffer: Buffer): Promise<void> {
	const host = process.env.CLAMAV_HOST;
	if (!host) {
		// ClamAV non configuré - fail-open intentionnel, pas un bug
		return;
	}

	const port = parseInt(process.env.CLAMAV_PORT ?? '3310', 10);

	try {
		const result = await sendToClamd(host, port, buffer);
		if (result.includes('FOUND')) {
			const virus = result.split(':')[1]?.trim() ?? 'unknown';
			logger.warn(`ClamAV détecté : ${virus}`);
			throw new UnprocessableEntityException(`File rejected by antivirus scanner: ${virus}`);
		}
		if (!result.includes('OK')) {
			logger.warn(`Réponse ClamAV inattendue: ${result}`);
		}
	} catch (err) {
		if (err instanceof UnprocessableEntityException) throw err;
		// Daemon inaccessible → fail-open avec warn pour ne pas bloquer les uploads légitimes
		logger.warn(
			`ClamAV inaccessible (${host}:${port}), upload autorisé par fail-open: ${err instanceof Error ? err.message : String(err)}`
		);
	}
}

/**
 * Envoie le buffer au daemon clamd via le protocole INSTREAM.
 * Format: "zINSTREAM\0" puis chunks <uint32-be-length><data> terminés par <uint32=0>.
 */
function sendToClamd(host: string, port: number, buffer: Buffer): Promise<string> {
	return new Promise((resolve, reject) => {
		const socket = new net.Socket();
		const timeout = 5000; // 5s max pour ne pas bloquer un upload

		socket.setTimeout(timeout);

		const chunks: Buffer[] = [];

		socket.connect(port, host, () => {
			// Commande INSTREAM en protocole null-terminated
			socket.write('zINSTREAM\0');

			// Chunk unique : longueur sur 4 octets big-endian + données
			const lenBuf = Buffer.alloc(4);
			lenBuf.writeUInt32BE(buffer.length, 0);
			socket.write(lenBuf);
			socket.write(buffer);

			// Fin de stream : chunk de longueur 0
			const endBuf = Buffer.alloc(4);
			endBuf.writeUInt32BE(0, 0);
			socket.write(endBuf);
		});

		socket.on('data', (chunk: Buffer) => chunks.push(chunk));

		socket.on('end', () => {
			socket.destroy();
			resolve(Buffer.concat(chunks).toString('utf8').trim());
		});

		socket.on('timeout', () => {
			socket.destroy();
			reject(new Error('ClamAV connection timeout'));
		});

		socket.on('error', (err) => {
			socket.destroy();
			reject(err);
		});
	});
}

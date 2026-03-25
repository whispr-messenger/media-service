import { UnsupportedMediaTypeException } from '@nestjs/common';

interface MagicEntry {
	bytes: number[];
	mask?: number[];
	offset?: number;
}

// A signature is a group of entries that ALL must match (AND semantics).
// MAGIC_MAP values are arrays of signatures; matching ANY signature is sufficient (OR semantics).
type MagicSignature = MagicEntry[];

/**
 * Maps MIME types to their magic byte signatures.
 * Each MIME type maps to an array of signatures (OR). Each signature is an
 * array of entries that must ALL match (AND). This lets us model multi-part
 * headers like WebP (RIFF at 0 AND WEBP at 8) or WAV (RIFF at 0 AND WAVE at 8).
 */
const MAGIC_MAP: Record<string, MagicSignature[]> = {
	// Images
	'image/jpeg': [[{ bytes: [0xff, 0xd8, 0xff] }]],
	'image/png': [[{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]],
	'image/gif': [[{ bytes: [0x47, 0x49, 0x46, 0x38] }]], // GIF8
	// WebP: RIFF at 0 AND WEBP at 8 (prevents matching non-WebP RIFF files like WAV)
	'image/webp': [
		[
			{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
			{ bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
		],
	],
	'image/heic': [[{ bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], offset: 4 }]],
	'image/heif': [[{ bytes: [0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31], offset: 4 }]],
	// Video
	'video/mp4': [[{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }]], // ftyp box
	'video/quicktime': [[{ bytes: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], offset: 4 }]],
	'video/webm': [[{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }]],
	'video/x-matroska': [[{ bytes: [0x1a, 0x45, 0xdf, 0xa3] }]],
	// Audio
	'audio/mpeg': [
		[{ bytes: [0xff, 0xfb] }],
		[{ bytes: [0xff, 0xf3] }],
		[{ bytes: [0xff, 0xf2] }],
		[{ bytes: [0x49, 0x44, 0x33] }],
	],
	'audio/ogg': [[{ bytes: [0x4f, 0x67, 0x67, 0x53] }]],
	// WAV: RIFF at 0 AND WAVE at 8 (prevents matching non-WAV RIFF files like WebP)
	'audio/wav': [
		[
			{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
			{ bytes: [0x57, 0x41, 0x56, 0x45], offset: 8 },
		],
	],
	'audio/mp4': [[{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }]],
	'audio/aac': [[{ bytes: [0xff, 0xf1] }], [{ bytes: [0xff, 0xf9] }]],
	// Documents
	'application/pdf': [[{ bytes: [0x25, 0x50, 0x44, 0x46] }]], // %PDF
	'application/msword': [[{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }]],
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
		[{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
	],
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
		[{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
	],
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
		[{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
	],
	'application/zip': [[{ bytes: [0x50, 0x4b, 0x03, 0x04] }]],
};

/** Number of bytes needed to check all signatures */
const MAX_MAGIC_BYTES = 16;

function matchesEntry(header: Buffer, entry: MagicEntry): boolean {
	const offset = entry.offset ?? 0;
	const { bytes } = entry;
	if (header.length < offset + bytes.length) {
		return false;
	}
	return bytes.every((b, i) => header[offset + i] === b);
}

/**
 * Validates that the first bytes of a buffer match the declared MIME type.
 * Throws UnsupportedMediaTypeException (415) on mismatch.
 * Passes through MIME types that are not in the magic map (e.g. text/plain).
 */
export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): void {
	// Normalise: strip parameters (e.g. "image/jpeg; charset=utf-8")
	const mime = declaredMimeType.split(';')[0].trim().toLowerCase();

	const signatures = MAGIC_MAP[mime];
	if (!signatures) {
		// Unknown MIME type — not a type we validate
		return;
	}

	const header = buffer.subarray(0, MAX_MAGIC_BYTES);

	// Match if ANY signature has ALL its entries matching
	const matches = signatures.some((sig) => sig.every((entry) => matchesEntry(header, entry)));

	if (!matches) {
		throw new UnsupportedMediaTypeException(
			`Content-Type '${mime}' does not match the actual file content`
		);
	}
}

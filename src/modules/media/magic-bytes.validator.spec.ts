import { UnsupportedMediaTypeException } from '@nestjs/common';
import { validateMagicBytes } from './magic-bytes.validator';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);

// MP4: 4 bytes size (any) + "ftyp"
const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

describe('validateMagicBytes()', () => {
	it('passes JPEG with image/jpeg', () => {
		expect(() => validateMagicBytes(jpeg, 'image/jpeg')).not.toThrow();
	});

	it('passes PNG with image/png', () => {
		expect(() => validateMagicBytes(png, 'image/png')).not.toThrow();
	});

	it('passes PDF with application/pdf', () => {
		expect(() => validateMagicBytes(pdf, 'application/pdf')).not.toThrow();
	});

	it('passes WebM with video/webm', () => {
		expect(() => validateMagicBytes(webm, 'video/webm')).not.toThrow();
	});

	it('passes MP4 with video/mp4', () => {
		expect(() => validateMagicBytes(mp4, 'video/mp4')).not.toThrow();
	});

	it('throws UnsupportedMediaTypeException when JPEG bytes are declared as image/png', () => {
		expect(() => validateMagicBytes(jpeg, 'image/png')).toThrow(UnsupportedMediaTypeException);
	});

	it('throws UnsupportedMediaTypeException when PNG bytes are declared as image/jpeg', () => {
		expect(() => validateMagicBytes(png, 'image/jpeg')).toThrow(UnsupportedMediaTypeException);
	});

	it('does not throw for MIME types not in the magic map (passes through)', () => {
		const textBuffer = Buffer.from('hello world');
		expect(() => validateMagicBytes(textBuffer, 'text/plain')).not.toThrow();
	});

	it('strips MIME type parameters before matching', () => {
		expect(() => validateMagicBytes(jpeg, 'image/jpeg; charset=utf-8')).not.toThrow();
	});

	it('is case-insensitive for the MIME type', () => {
		expect(() => validateMagicBytes(jpeg, 'IMAGE/JPEG')).not.toThrow();
	});

	it('throws when buffer is too short to contain magic bytes', () => {
		const tinyBuf = Buffer.from([0x89, 0x50]); // only 2 bytes of PNG header
		expect(() => validateMagicBytes(tinyBuf, 'image/png')).toThrow(UnsupportedMediaTypeException);
	});
});

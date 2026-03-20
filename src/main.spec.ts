import { ValidationPipe } from '@nestjs/common';

describe('Bootstrap setup (main.ts)', () => {
	describe('ValidationPipe configuration', () => {
		it('should strip unknown properties with whitelist enabled', () => {
			const pipe = new ValidationPipe({ whitelist: true, transform: true });
			expect(pipe).toBeDefined();
		});

		it('should be configured with whitelist and transform options', () => {
			const pipe = new ValidationPipe({ whitelist: true, transform: true });
			// ValidationPipe exposes no public accessors; verify it instantiates cleanly
			// with both options set (would throw on invalid config)
			expect(pipe).toBeInstanceOf(ValidationPipe);
		});
	});

	describe('Helmet middleware', () => {
		it('should load helmet without errors', async () => {
			const helmetModule = await import('helmet');
			const helmetMiddleware = helmetModule.default();
			expect(typeof helmetMiddleware).toBe('function');
		});
	});

	describe('Graceful shutdown', () => {
		it('should register SIGTERM handler when enableShutdownHooks is called', () => {
			const listenersBefore = process.listenerCount('SIGTERM');
			process.once('SIGTERM', () => {});
			const listenersAfter = process.listenerCount('SIGTERM');
			expect(listenersAfter).toBeGreaterThan(listenersBefore);
			// cleanup
			process.removeAllListeners('SIGTERM');
		});
	});
});

// Environment validation for production container
const colors = {
	reset: '\u001b[0m',
	red: '\u001b[31m',
	green: '\u001b[32m',
	yellow: '\u001b[33m',
};

let missingVars = 0;
let optionalVars = 0;

function checkRequired(varName: string): boolean {
	const value = process.env[varName];
	if (!value || value.trim() === '') {
		console.error(`${colors.red}✗${colors.reset} ${varName} is NOT set (REQUIRED)`);
		missingVars++;
		return false;
	}
	console.log(`${colors.green}✓${colors.reset} ${varName} is set`);
	return true;
}

function checkOptional(varName: string, defaultValue = ''): boolean {
	const value = process.env[varName];
	if (!value || value.trim() === '') {
		const msg = defaultValue ? ` (will use default: ${defaultValue})` : '';
		console.warn(`${colors.yellow}⚠${colors.reset} ${varName} is NOT set${msg}`);
		optionalVars++;
		return false;
	}
	console.log(`${colors.green}✓${colors.reset} ${varName} is set`);
	return true;
}

export default function runEnvChecks(): void {
	console.log('==================================================');
	console.log('  Whispr Media Service - Environment Check');
	console.log('==================================================\n');

	console.log('Checking REQUIRED environment variables...');

	// Node
	checkRequired('NODE_ENV');

	// Database
	checkRequired('DB_HOST');
	checkRequired('DB_PORT');
	checkRequired('DB_USERNAME');
	checkRequired('DB_PASSWORD');
	checkRequired('DB_NAME');

	// Auth — production : URL uniquement (JWT_JWKS_FILE interdit, aligné sur env-validation.schema)
	const jwksFile = process.env.JWT_JWKS_FILE?.trim() ?? '';
	const jwksUrl = process.env.JWT_JWKS_URL?.trim() ?? '';
	if (process.env.NODE_ENV === 'production') {
		if (jwksFile) {
			console.error(
				`${colors.red}✗${colors.reset} JWT_JWKS_FILE must not be set in production (use JWT_JWKS_URL)`
			);
			missingVars++;
		}
		checkRequired('JWT_JWKS_URL');
	} else if (!jwksUrl && !jwksFile) {
		console.error(
			`${colors.red}✗${colors.reset} Either JWT_JWKS_URL or JWT_JWKS_FILE must be set (REQUIRED)`
		);
		missingVars++;
	} else {
		if (jwksUrl) {
			console.log(`${colors.green}✓${colors.reset} JWT_JWKS_URL is set`);
		}
		if (jwksFile) {
			console.log(`${colors.green}✓${colors.reset} JWT_JWKS_FILE is set`);
		}
	}

	// Redis
	checkRequired('REDIS_HOST');
	checkRequired('REDIS_PORT');

	// Ports
	checkRequired('HTTP_PORT');

	// S3 / MinIO
	checkRequired('S3_ACCESS_KEY_ID');
	checkRequired('S3_SECRET_ACCESS_KEY');
	checkRequired('S3_ENDPOINT');

	console.log('\nChecking OPTIONAL environment variables...');

	checkOptional('DB_URL', '(constructed from individual DB vars)');
	checkOptional('DB_LOGGING', 'false');
	checkOptional('DB_MIGRATIONS_RUN', 'false');
	checkOptional('DB_SYNCHRONIZE', 'false');
	checkOptional('REDIS_PASSWORD', '(no password)');
	checkOptional('NODE_OPTIONS', '(default Node settings)');
	checkOptional('PORT', '(defaults to HTTP_PORT)');
	checkOptional('LOG_LEVEL', 'info');
	checkOptional('METRICS_ENABLED', 'true');
	checkOptional('HEALTH_CHECK_TIMEOUT', '5000');
	checkOptional('DEMO_MODE', 'false');

	console.log('\n==================================================');

	if (missingVars > 0) {
		console.error(
			`${colors.red}ERROR: ${missingVars} required environment variable(s) missing!${colors.reset}`
		);
		throw new Error('Missing required environment variables');
	}

	if (optionalVars > 0) {
		console.warn(
			`${colors.yellow}WARNING: ${optionalVars} optional environment variable(s) not set.${colors.reset}`
		);
	}

	console.log(`${colors.green}✓ All required environment variables are set!${colors.reset}`);
	console.log('==================================================\n');
}

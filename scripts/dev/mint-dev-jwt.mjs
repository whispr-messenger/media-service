/**
 * Génère un JWT ES256 signé avec la clé dev (scripts/dev/private.jwk.json.example).
 * Usage : node scripts/dev/mint-dev-jwt.mjs
 * Copie la sortie dans Postman : Authorization → Bearer Token
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jwkPath = resolve(__dirname, 'private.jwk.json.example');
const jwk = JSON.parse(readFileSync(jwkPath, 'utf8'));
const key = createPrivateKey({ key: jwk, format: 'jwk' });

const header = { alg: 'ES256', typ: 'JWT', kid: 'dev-local' };
const now = Math.floor(Date.now() / 1000);
// sub doit être un UUID (colonne owner_id / user_quotas en base)
const payload = {
	sub: '00000000-0000-4000-8000-000000000001',
	jti: `jti-${now}-${Math.random().toString(36).slice(2, 11)}`,
	deviceId: '00000000-0000-4000-8000-0000000000a1',
	iat: now,
	exp: now + 3600,
};

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const signingInput = `${b64url(header)}.${b64url(payload)}`;
const sig = sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
const token = `${signingInput}.${Buffer.from(sig).toString('base64url')}`;

console.log(token);

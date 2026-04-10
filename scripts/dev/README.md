# Fichiers JWT / JWKS — développement et tests uniquement

Ces fichiers servent à faire tourner le media-service **sans** service d’auth distant. **Ne pas utiliser en production** : en `NODE_ENV=production`, `JWT_JWKS_FILE` est refusé par la validation d’environnement ; utilisez uniquement `JWT_JWKS_URL` vers votre fournisseur d’identité.

## Contenu

- `jwks.json` — document JWKS (clé publique ES256 P-256) chargé si `JWT_JWKS_FILE=scripts/dev/jwks.json`.
- `private.jwk.json.example` — même paire, clé **privée** (exemple). Copiez vers `private.jwk.json` (gitignored) si un outil en a besoin. **Jamais** en prod.

## Obtenir un JWT de test

Depuis la racine du dépôt :

```bash
node scripts/dev/mint-dev-jwt.mjs
```

Copie le token dans Postman : **Authorization → Type : Bearer Token**.

Le garde-fou exige **`sub`**, **`jti`** et **`deviceId`** (le script les remplit). En variante, utilisez un outil ES256 avec `private.jwk.json.example` (par ex. [jwt.io](https://www.jwt.io)).

## MinIO (S3 local)

Voir `docker-compose.dev.yml` à la racine du dépôt : `npm run dev:stack:up` démarre MinIO sur le port 9000 (console 9001), avec le bucket `whispr-media`.

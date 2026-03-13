# Guide d'Intégration - Media Service

## Vue d'ensemble

Le Media Service est un microservice NestJS qui agit comme **store-and-forward aveugle** : il stocke et distribue des blobs chiffrés sans accéder à leur contenu. Il s'intègre avec le auth-service et le user-service via gRPC.

Le traitement des médias (compression, resize, génération de thumbnails) est entièrement délégué au client mobile, qui effectue ces opérations **avant chiffrement**.

---

## Architecture d'Intégration

### Services Externes

#### 1. Auth Service (gRPC)
- **Port** : 50051
- **Protocole** : gRPC over mTLS (Istio)
- **Fonctionnalités** :
  - Validation des tokens JWT
  - Récupération du `userId` depuis le token

#### 2. User Service (gRPC)
- **Port** : 50053
- **Protocole** : gRPC over mTLS (Istio)
- **Fonctionnalités** :
  - Récupération des limites de quota utilisateur
  - Mise à jour de l'utilisation du stockage

#### 3. MinIO / S3-compatible
- **Protocole** : HTTPS (TLS 1.3)
- **Authentification** : credentials IAM / Service Account
- **Fonctionnalités** :
  - Stockage des blobs chiffrés
  - Génération de signed URLs (presigned URLs)
  - Lifecycle policies pour l'expiration automatique

#### 4. Redis Cache
- **Port** : 6379
- **Fonctionnalités** :
  - Cache des quotas utilisateur (TTL 1h)
  - Cache des métadonnées média (TTL 30min)
  - Sessions d'upload temporaires (TTL 24h)
  - Déduplication de blobs (TTL 7j)

#### 5. PostgreSQL
- **Port** : 5432
- **ORM** : TypeORM
- **Fonctionnalités** :
  - Métadonnées des médias
  - Quotas utilisateur
  - Logs d'accès

---

## Configuration

### Variables d'Environnement

```bash
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/media_db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="your_redis_password"

# MinIO / S3
S3_ENDPOINT="http://localhost:9000"         # MinIO en dev, endpoint S3 en prod
S3_ACCESS_KEY="your_access_key"
S3_SECRET_KEY="your_secret_key"
S3_BUCKET="whispr-media"
S3_REGION="eu-west-1"

# Services gRPC
AUTH_SERVICE_URL="localhost:50051"
USER_SERVICE_URL="localhost:50053"

# Serveur
PORT=3000
NODE_ENV="development"

# Signed URLs
SIGNED_URL_EXPIRY_SECONDS=604800   # 7 jours pour les médias message
```

### Docker Compose (développement)

```yaml
version: '3.8'
services:
  media-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/media_db
      - REDIS_HOST=redis
      - AUTH_SERVICE_URL=auth-service:50051
      - USER_SERVICE_URL=user-service:50053
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY=minioadmin
      - S3_SECRET_KEY=minioadmin
      - S3_BUCKET=whispr-media
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: media_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass password

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

---

## API Endpoints

### Upload de Blob

```http
POST /media/v1/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>

Champs:
  file        (required)  blob chiffré principal
  thumbnail   (optional)  blob chiffré thumbnail (généré côté client)
  context     (required)  "message" | "avatar" | "group_icon"
  ownerId     (required)  userId ou groupId
```

**Réponse 201** :
```json
{
  "mediaId": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://cdn.whispr.epitech.beer/messages/uuid.bin?X-Amz-Signature=...",
  "thumbnailUrl": "https://cdn.whispr.epitech.beer/thumbnails/uuid.bin?X-Amz-Signature=...",
  "expiresAt": "2026-03-20T00:00:00Z",
  "context": "message",
  "size": 1048576
}
```

`expiresAt` est `null` pour `avatar` et `group_icon`. `thumbnailUrl` est `null` si aucun thumbnail n'a été fourni.

### Récupération des Métadonnées

```http
GET /media/v1/:id
Authorization: Bearer <jwt_token>
```

### Téléchargement du Blob

```http
GET /media/v1/:id/blob
Authorization: Bearer <jwt_token>
```

Retourne un redirect (302) vers la signed URL du blob.

### Téléchargement du Thumbnail

```http
GET /media/v1/:id/thumbnail
Authorization: Bearer <jwt_token>
```

Retourne un redirect (302) vers la signed URL du thumbnail.

### Suppression

```http
DELETE /media/v1/:id
Authorization: Bearer <jwt_token>
```

### Quota Utilisateur

```http
GET /media/v1/quota
Authorization: Bearer <jwt_token>
```

**Réponse 200** :
```json
{
  "storageUsed": 524288000,
  "storageLimit": 1073741824,
  "filesCount": 42,
  "filesLimit": 1000,
  "dailyUploads": 5,
  "dailyUploadLimit": 100
}
```

---

## Intégration avec les Clients

### Application Mobile — Upload d'un Média Message

Le client effectue tout le traitement **avant** d'appeler le media-service :

```typescript
// 1. Compression / resize côté client (avant chiffrement)
const compressed = await compressMedia(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85,
});

// 2. Génération du thumbnail côté client
const thumbnail = await generateThumbnail(compressed, { width: 256, height: 256 });

// 3. Chiffrement Signal (protocole géré par la lib Signal)
const { encryptedBlob, encryptedThumbnail, key, iv } = await signalEncryptMedia(compressed, thumbnail);

// 4. Upload des blobs chiffrés
const formData = new FormData();
formData.append('file', encryptedBlob);
formData.append('thumbnail', encryptedThumbnail);
formData.append('context', 'message');
formData.append('ownerId', userId);

const response = await fetch('/media/v1/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});

const { mediaId, url, thumbnailUrl, expiresAt } = await response.json();

// 5. Inclure { mediaId, url, thumbnailUrl, key, iv } dans le message Signal
await sendSignalMessage(conversationId, {
  type: 'media',
  mediaId,
  url,
  thumbnailUrl,
  key,    // clé de déchiffrement — transmise via Signal, jamais via media-service
  iv,
  expiresAt,
});
```

### Application Mobile — Upload d'un Avatar

Les avatars ne sont pas chiffrés E2E — ils sont traités côté client (compression uniquement) et uploadés en clair :

```typescript
// Compression côté client
const compressed = await compressImage(file, { maxSize: 512, format: 'webp', quality: 0.9 });

const formData = new FormData();
formData.append('file', compressed);
formData.append('context', 'avatar');
formData.append('ownerId', userId);

const { mediaId, url } = await fetch('/media/v1/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
}).then(r => r.json());

// url est une URL publique permanente (expiresAt: null)
await updateUserProfile({ avatarUrl: url });
```

### Application Mobile — Affichage d'un Média Message

```typescript
// La clé K a été reçue dans le message Signal
const { mediaId, url, thumbnailUrl, key, iv } = signalMessage.media;

// Afficher le thumbnail (déchiffrement local)
const thumbnailBlob = await fetch(thumbnailUrl).then(r => r.blob());
const decryptedThumbnail = await signalDecryptMedia(thumbnailBlob, key, iv);
displayThumbnail(decryptedThumbnail);

// Au tap : télécharger et déchiffrer le média principal
const blob = await fetch(url).then(r => r.blob());
const decryptedMedia = await signalDecryptMedia(blob, key, iv);
displayMedia(decryptedMedia);
```

### Backend Services — Vérification d'Accès

Un autre service backend vérifiant qu'un média existe et est actif :

```typescript
const response = await fetch(`/media/v1/${mediaId}`, {
  headers: {
    'Authorization': `Bearer ${serviceToken}`,
  },
});

if (!response.ok) {
  // Média supprimé ou expiré
}

const { context, size, expiresAt } = await response.json();
```

---

## Sécurité

### Chiffrement

- **Médias `message`** : chiffrés E2E via Signal Protocol (AES-256-CBC + HMAC-SHA256) — le serveur ne voit que des blobs opaques
- **Médias `avatar` / `group_icon`** : chiffrés côté serveur au repos (AES-256-GCM, clé serveur)
- Les clés Signal ne transitent jamais via le media-service

### Authentification

- Validation JWT via le auth-service (gRPC mTLS) sur toutes les routes
- Propriété des ressources vérifiée via le `userId` extrait du JWT

### Validation des Uploads

- Magic bytes : vérification type MIME déclaré vs contenu réel du blob
- Taille max par context (100 MB pour `message`, 5 MB pour `avatar`/`group_icon`)
- Quota utilisateur vérifié avant acceptation

---

## Monitoring et Logs

### Métriques Prometheus

- Nombre d'uploads par minute, par context
- Taille moyenne des blobs par context
- Taux d'erreur par type (quota dépassé, auth échouée, etc.)
- Latence des appels gRPC vers auth-service et user-service

### Logs Structurés

```json
{
  "timestamp": "2026-03-13T10:30:00Z",
  "level": "info",
  "service": "media-service",
  "action": "blob_upload",
  "userId": "user-123",
  "mediaId": "media-456",
  "context": "message",
  "blobSize": 1048576,
  "duration": 850
}
```

> Les logs ne contiennent jamais d'information sur le contenu des blobs (illisible) ni de métadonnées EXIF.

---

## Déploiement

### Prérequis

1. Docker et Docker Compose
2. Instance MinIO (dev) ou accès S3-compatible (prod)
3. PostgreSQL
4. Redis
5. Auth-service et User-service accessibles

### Étapes

```bash
# 1. Cloner le repository
git clone <repository-url>
cd media-service

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env

# 3. Générer et appliquer les migrations TypeORM
npm run typeorm:migration:generate
npm run typeorm:migration:run

# 4. Démarrer
docker-compose up -d

# 5. Vérifier
curl http://localhost:3000/health
```

---

## Dépannage

### Erreur gRPC vers auth-service
- Vérifier que auth-service est démarré et accessible sur le port 50051
- Vérifier `AUTH_SERVICE_URL` dans les variables d'environnement

### Erreur MinIO / S3
- Vérifier les credentials (`S3_ACCESS_KEY`, `S3_SECRET_KEY`)
- Vérifier que le bucket `S3_BUCKET` existe
- En dev : `docker-compose logs minio`

### Quota non mis à jour
- Vérifier la connexion Redis (`REDIS_HOST`, `REDIS_PORT`)
- Le cache quota a un TTL de 1h — les mises à jour peuvent être décalées

### Logs de Debug

```bash
export LOG_LEVEL=debug
docker-compose logs -f media-service
```

---

## Support

- Documentation technique : `/documentation`
- Issues GitHub : `<repository-url>/issues`

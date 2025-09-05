# Media Service - Whispr

## Description

Le Media Service est un microservice NestJS haute performance conçu pour gérer l'upload, le stockage, la compression et la distribution sécurisée des fichiers multimédias dans l'écosystème Whispr. Il offre un chiffrement de bout en bout, une intégration cloud native et des fonctionnalités avancées de traitement d'images et vidéos.

## Fonctionnalités Principales

### Sécurité
- **Chiffrement AES-256-GCM** : Tous les fichiers sont chiffrés avant stockage
- **Authentification JWT** : Intégration avec le service d'authentification
- **Validation de contenu** : Analyse automatique via le service de modération
- **Permissions granulaires** : Contrôle d'accès par utilisateur et ressource

### Gestion des Médias
- **Upload multiformat** : Support images, vidéos, documents
- **Compression intelligente** : Optimisation automatique des fichiers
- **Génération d'aperçus** : Thumbnails pour images et vidéos
- **Catégorisation** : Organisation par types et catégories
- **Gestion des quotas** : Limites par utilisateur configurables

### Infrastructure Cloud
- **Google Cloud Storage** : Stockage scalable et sécurisé
- **Redis Cache** : Performance optimisée avec mise en cache
- **PostgreSQL** : Base de données relationnelle robuste
- **Docker** : Déploiement containerisé

### Intégrations
- **gRPC** : Communication haute performance avec autres services
- **REST API** : Interface standard pour clients web/mobile
- **Prometheus** : Métriques et monitoring
- **Winston** : Logging structuré

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Web    │    │    Mobile App   │    │  Other Services │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   │      Media Service        │
                   │     (NestJS + TS)         │
                   └─────────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐      ┌─────────▼────────┐     ┌─────────▼────────┐
│ Auth Service  │      │ Moderation       │     │ Google Cloud     │
│ (gRPC:50051)  │      │ Service          │     │ Storage          │
└───────────────┘      │ (gRPC:50052)     │     └──────────────────┘
                       └──────────────────┘
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼───────┐      ┌──────────▼──────────┐     ┌────────▼────────┐
│ PostgreSQL    │      │ Redis Cache         │     │ File System     │
│ (Port: 5432)  │      │ (Port: 6379)        │     │ (Temp Storage)  │
└───────────────┘      └─────────────────────┘     └─────────────────┘
```

## Installation

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Compte Google Cloud avec Storage API

### Installation Locale

1. **Cloner le repository**
```bash
git clone <repository-url>
cd media-service
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer l'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

4. **Configurer la base de données**
```bash
npm run prisma:generate
npm run prisma:migrate
```

5. **Démarrer en mode développement**
```bash
npm run start:dev
```

### Installation Docker

1. **Démarrer avec Docker Compose**
```bash
docker-compose up -d
```

2. **Vérifier le déploiement**
```bash
curl http://localhost:3000/health
```

## Configuration

### Variables d'Environnement

| Variable | Description | Exemple |
|----------|-------------|----------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_HOST` | Hôte Redis | `localhost` |
| `REDIS_PORT` | Port Redis | `6379` |
| `REDIS_PASSWORD` | Mot de passe Redis | `your_password` |
| `GOOGLE_CLOUD_PROJECT_ID` | ID du projet GCP | `your-project-id` |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | Nom du bucket GCS | `your-bucket-name` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin vers le service account | `/path/to/credentials.json` |
| `AUTH_SERVICE_URL` | URL du service d'auth | `localhost:50051` |
| `MODERATION_SERVICE_URL` | URL du service de modération | `localhost:50052` |
| `ENCRYPTION_KEY` | Clé de chiffrement (32 bytes) | `your-32-byte-encryption-key` |
| `PORT` | Port du serveur | `3000` |
| `NODE_ENV` | Environnement | `development` |

### Configuration des Quotas

```typescript
// Dans src/config/media.config.ts
export const mediaConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif',
    'video/mp4', 'video/avi', 'video/quicktime',
    'application/pdf', 'text/plain'
  ],
  quotas: {
    free: { storage: 1024 * 1024 * 1024, files: 1000 }, // 1GB, 1000 files
    premium: { storage: 10 * 1024 * 1024 * 1024, files: 10000 } // 10GB, 10000 files
  }
};
```

## API Documentation

### Endpoints Principaux

#### Upload de Fichier
```http
POST /api/v1/media/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- file: <fichier>
- conversationId?: <uuid>
- messageId?: <uuid>
- categoryId?: <uuid>
- isTemporary?: <boolean>
```

**Réponse:**
```json
{
  "id": "media-uuid",
  "filename": "encrypted-filename",
  "originalName": "photo.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 1024000,
  "isCompressed": true,
  "hasPreview": true,
  "uploadedAt": "2024-01-15T10:30:00Z",
  "downloadUrl": "/api/v1/media/media-uuid/download",
  "previewUrl": "/api/v1/media/media-uuid/preview"
}
```

#### Téléchargement
```http
GET /api/v1/media/:id/download
Authorization: Bearer <token>
```

#### Aperçu
```http
GET /api/v1/media/:id/preview
Authorization: Bearer <token>
```

#### Suppression
```http
DELETE /api/v1/media/:id
Authorization: Bearer <token>
```

### Documentation Swagger
Accédez à la documentation interactive à : `http://localhost:3000/api/docs`
## Tests

### Exécuter les Tests
```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:cov

# Tests en mode watch
npm run test:watch

# Tests d'intégration
npm run test:e2e
```

### Structure des Tests
```
src/
├── modules/
│   ├── encryption/
│   │   ├── encryption.service.ts
│   │   └── encryption.service.spec.ts
│   ├── media/
│   │   ├── media.service.ts
│   │   ├── media.service.spec.ts
│   │   ├── media.controller.ts
│   │   └── media.controller.spec.ts
│   └── cache/
│       ├── redis.service.ts
│       └── redis.service.spec.ts
└── test/
    └── setup.ts
```

## Déploiement

### Environnement de Production

1. **Build de l'application**
```bash
npm run build
```

2. **Démarrage en production**
```bash
npm run start:prod
```

### Docker en Production

```dockerfile
# Dockerfile optimisé pour la production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: media-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: media-service
  template:
    metadata:
      labels:
        app: media-service
    spec:
      containers:
      - name: media-service
        image: media-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: media-secrets
              key: database-url
```

## Monitoring

### Métriques Prometheus
- `media_uploads_total` : Nombre total d'uploads
- `media_upload_duration_seconds` : Durée des uploads
- `media_file_size_bytes` : Taille des fichiers
- `media_storage_usage_bytes` : Utilisation du stockage
- `media_errors_total` : Nombre d'erreurs

### Health Checks
```http
GET /health
```

**Réponse:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "storage": { "status": "up" }
  }
}
```

## Développement

### Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run start` | Démarrage normal |
| `npm run start:dev` | Mode développement avec hot-reload |
| `npm run start:debug` | Mode debug |
| `npm run build` | Build de production |
| `npm run test` | Tests unitaires |
| `npm run test:e2e` | Tests d'intégration |
| `npm run lint` | Linting du code |
| `npm run format` | Formatage du code |
| `npm run prisma:generate` | Génération du client Prisma |
| `npm run prisma:migrate` | Migration de la base |
| `npm run prisma:studio` | Interface graphique Prisma |

### Structure du Projet

```
media-service/
├── src/
│   ├── config/           # Configurations
│   ├── modules/
│   │   ├── auth/         # Authentification
│   │   ├── cache/        # Cache Redis
│   │   ├── database/     # Base de données
│   │   ├── encryption/   # Chiffrement
│   │   ├── grpc/         # Clients gRPC
│   │   ├── media/        # Gestion des médias
│   │   └── storage/      # Stockage cloud
│   ├── test/             # Configuration des tests
│   ├── app.module.ts     # Module principal
│   └── main.ts           # Point d'entrée
├── prisma/
│   └── schema.prisma     # Schéma de base de données
├── proto/                # Fichiers Protocol Buffers
├── documentation/        # Documentation technique
├── docker-compose.yml    # Configuration Docker
├── Dockerfile           # Image Docker
├── jest.config.js       # Configuration Jest
└── package.json         # Dépendances
```

## Contribution

### Guidelines
1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Standards de Code
- **ESLint** : Respect des règles de linting
- **Prettier** : Formatage automatique
- **Tests** : Couverture minimale de 80%
- **Documentation** : JSDoc pour les fonctions publiques
- **Commits** : Messages conventionnels

## Licence

Ce projet est sous licence privée. Tous droits réservés à l'équipe Whispr.

## Support

- **Documentation** : [INTEGRATION.md](./INTEGRATION.md)
- **Issues** : GitHub Issues
- **Email** : dev-team@whispr.com
- **Discord** : DALM1 #4866

## Changelog

### v1.0.0 (2024-01-15)
- Implémentation initiale du service
- Chiffrement AES-256-GCM
- Intégration Google Cloud Storage
- API REST complète
- Suite de tests complète
- Monitoring Prometheus
- Support Docker

---

**Développé par l'équipe Whispr**

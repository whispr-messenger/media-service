# Guide d'Intégration - Media Service

## Vue d'ensemble

Le Media Service est un microservice NestJS conçu pour gérer l'upload, le stockage, la compression et la distribution sécurisée des fichiers multimédias dans l'écosystème Whispr. Il s'intègre avec plusieurs services externes via gRPC et REST.

## Architecture d'Intégration

### Services Externes

#### 1. Auth Service (gRPC)
- **Port**: 50051
- **Protocole**: gRPC
- **Fichier Proto**: `proto/auth.proto`
- **Fonctionnalités**:
  - Validation des tokens JWT
  - Vérification des permissions utilisateur
  - Gestion des quotas utilisateur

#### 2. Moderation Service (gRPC)
- **Port**: 50052
- **Protocole**: gRPC
- **Fichier Proto**: `proto/moderation.proto`
- **Fonctionnalités**:
  - Analyse de contenu pour détecter le contenu inapproprié
  - Validation des fichiers avant stockage
  - Blacklist de hachages de fichiers

#### 3. Google Cloud Storage
- **Service**: Cloud Storage
- **Authentification**: Service Account JSON
- **Fonctionnalités**:
  - Stockage sécurisé des fichiers chiffrés
  - Gestion des buckets par environnement
  - URLs signées pour l'accès temporaire

#### 4. Redis Cache
- **Port**: 6379
- **Fonctionnalités**:
  - Cache des quotas utilisateur
  - Métadonnées des médias
  - Sessions de téléchargement temporaires

#### 5. PostgreSQL
- **Port**: 5432
- **ORM**: Prisma
- **Fonctionnalités**:
  - Stockage des métadonnées des médias
  - Gestion des catégories
  - Logs d'accès

## Configuration

### Variables d'Environnement

```bash
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/media_db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="your_redis_password"

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID="your-project-id"
GOOGLE_CLOUD_STORAGE_BUCKET="your-bucket-name"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Services gRPC
AUTH_SERVICE_URL="localhost:50051"
MODERATION_SERVICE_URL="localhost:50052"

# Chiffrement
ENCRYPTION_KEY="your-32-byte-encryption-key"

# Serveur
PORT=3000
NODE_ENV="development"
```

### Docker Compose

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
      - MODERATION_SERVICE_URL=moderation-service:50052
    depends_on:
      - postgres
      - redis
    volumes:
      - ./service-account.json:/app/service-account.json

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: media_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass password

volumes:
  postgres_data:
```

## API Endpoints

### Upload de Fichier
```http
POST /api/v1/media/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>

Body:
- file: <fichier>
- conversationId: <uuid> (optionnel)
- messageId: <uuid> (optionnel)
- categoryId: <uuid> (optionnel)
- isTemporary: <boolean> (optionnel)
```

### Téléchargement de Fichier
```http
GET /api/v1/media/:id/download
Authorization: Bearer <jwt_token>
```

### Aperçu de Fichier
```http
GET /api/v1/media/:id/preview
Authorization: Bearer <jwt_token>
```

### Suppression de Fichier
```http
DELETE /api/v1/media/:id
Authorization: Bearer <jwt_token>
```

### Récupération des Médias Utilisateur
```http
GET /api/v1/media/my-media?page=1&limit=10
Authorization: Bearer <jwt_token>
```

### Récupération des Catégories
```http
GET /api/v1/media/categories
Authorization: Bearer <jwt_token>
```

## Intégration avec les Clients

### Frontend Web/Mobile

#### Upload de Fichier
```javascript
const uploadFile = async (file, options = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (options.conversationId) {
    formData.append('conversationId', options.conversationId);
  }
  
  const response = await fetch('/api/v1/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

#### Affichage d'Image avec Aperçu
```javascript
const MediaPreview = ({ mediaId, token }) => {
  const previewUrl = `/api/v1/media/${mediaId}/preview`;
  const downloadUrl = `/api/v1/media/${mediaId}/download`;
  
  return (
    <img 
      src={previewUrl}
      onClick={() => window.open(downloadUrl)}
      headers={{ 'Authorization': `Bearer ${token}` }}
    />
  );
};
```

### Backend Services

#### Validation des Permissions
```javascript
// Dans votre middleware d'authentification
const validateMediaAccess = async (mediaId, userId) => {
  const response = await fetch(`/api/v1/media/${mediaId}`, {
    headers: {
      'Authorization': `Bearer ${serviceToken}`,
      'X-User-ID': userId
    }
  });
  
  return response.ok;
};
```

## Sécurité

### Chiffrement
- Tous les fichiers sont chiffrés avec AES-256-GCM avant stockage
- Les clés de chiffrement sont générées aléatoirement pour chaque fichier
- Les clés sont stockées de manière sécurisée dans la base de données

### Authentification
- Validation JWT via le Auth Service
- Vérification des permissions par endpoint
- Rate limiting configuré

### Validation de Contenu
- Analyse automatique via le Moderation Service
- Blacklist de hachages de fichiers malveillants
- Validation des types MIME autorisés

## Monitoring et Logs

### Métriques Prometheus
- Nombre d'uploads par minute
- Taille moyenne des fichiers
- Temps de traitement
- Erreurs par type

### Logs Structurés
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "media-service",
  "action": "file_upload",
  "userId": "user-123",
  "fileId": "file-456",
  "fileSize": 1024000,
  "mimeType": "image/jpeg",
  "duration": 1500
}
```

## Déploiement

### Prérequis
1. Docker et Docker Compose installés
2. Compte Google Cloud avec Storage API activé
3. Service Account avec permissions Storage
4. Base de données PostgreSQL
5. Instance Redis

### Étapes de Déploiement

1. **Cloner le repository**
```bash
git clone <repository-url>
cd media-service
```

2. **Configurer les variables d'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

3. **Générer le client Prisma**
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **Construire et démarrer**
```bash
docker-compose up -d
```

5. **Vérifier le déploiement**
```bash
curl http://localhost:3000/health
```

## Dépannage

### Problèmes Courants

#### Erreur de Connexion gRPC
- Vérifier que les services Auth et Moderation sont démarrés
- Contrôler les URLs de connexion dans les variables d'environnement
- Vérifier les certificats TLS si utilisés

#### Erreur Google Cloud Storage
- Vérifier les permissions du Service Account
- Contrôler que le bucket existe et est accessible
- Vérifier le chemin vers le fichier de credentials

#### Problèmes de Performance
- Monitorer l'utilisation Redis pour le cache
- Vérifier les index de base de données
- Analyser les logs de performance

### Logs de Debug
```bash
# Activer les logs détaillés
export LOG_LEVEL=debug

# Suivre les logs en temps réel
docker-compose logs -f media-service
```

## Support

Pour toute question ou problème d'intégration :
- Documentation technique : `/documentation`
- Issues GitHub : `<repository-url>/issues`
- Contact équipe : `dev-team@whispr.com`
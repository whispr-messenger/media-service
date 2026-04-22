# Intégration S3 / MinIO

## Flux

```
Media Service ──▶ S3 Client ──▶ MinIO Bucket
                                     │
                               Fichier chiffré
                               + métadonnées
```

## Configuration

| Variable | Description |
|----------|-------------|
| S3_ENDPOINT | URL du endpoint S3 (MinIO) |
| S3_PUBLIC_ENDPOINT | URL publique pour les URLs présignées |
| S3_BUCKET | Nom du bucket |
| S3_REGION | Région S3 |
| S3_ACCESS_KEY_ID | Clé d'accès |
| S3_SECRET_ACCESS_KEY | Clé secrète |
| S3_FORCE_PATH_STYLE | Force le path style (true pour MinIO) |

# Intégration Google Cloud Storage

## Flux

```
Media Service ──▶ GCS Client ──▶ Bucket whispr-media
                                       │
                                 Fichier chiffré
                                 + métadonnées
```

## Configuration

| Variable | Description |
|----------|-------------|
| GOOGLE_CLOUD_PROJECT_ID | ID projet GCP |
| GOOGLE_CLOUD_STORAGE_BUCKET | Nom du bucket |
| GOOGLE_APPLICATION_CREDENTIALS | Chemin service account |

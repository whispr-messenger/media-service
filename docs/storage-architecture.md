# Architecture stockage

## Schéma

```
┌──────────────┐     ┌──────────────┐
│ Media Service│────▶│ S3 Client    │
└──────────────┘     └──────┬───────┘
                            │
                    ┌───────▼───────┐
                    │    MinIO      │
                    │   Bucket      │
                    │               │
                    │ fichier.enc   │
                    │ (chiffré)     │
                    └───────────────┘
```

Les fichiers sont toujours chiffrés avant stockage.

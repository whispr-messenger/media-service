# Flux d'upload

## Schéma

```
Client
  │
  ▼ POST /media/v1/upload
┌──────────────┐
│ Media Service│
└──────┬───────┘
       │
  ┌────▼────┐
  │ Validate│ (type, taille, quota)
  └────┬────┘
       │
  ┌────▼──────────┐
  │ Chiffrement   │ AES-256-GCM
  └────┬──────────┘
       │
  ┌────▼──────────┐
  │ Compression   │ (images uniquement)
  └────┬──────────┘
       │
  ┌────▼──────────┐
  │ Upload S3     │ (MinIO)
  └────┬──────────┘
       │
  ┌────▼──────────┐
  │ Modération    │ (async via gRPC)
  └────┬──────────┘
       │
  Réponse client
  (URL présignée)
```

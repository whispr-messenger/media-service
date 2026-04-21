# Flux d'upload

## Schéma

```
Client
  │
  ▼ POST /api/v1/media/upload
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
  │ Upload GCS    │
  └────┬──────────┘
       │
  ┌────▼──────────┐
  │ Modération    │ (async via gRPC)
  └────┬──────────┘
       │
  Réponse client
```

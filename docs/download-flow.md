# Flux de téléchargement

## Schéma

```
Client ──▶ GET /media/v1/:id/blob
                │
          ┌─────▼─────┐
          │ Vérif JWT  │
          │ + permissions│
          └─────┬─────┘
                │
          ┌─────▼─────┐
          │ Fetch S3   │
          │ (MinIO)    │
          └─────┬─────┘
                │
          ┌─────▼──────────┐
          │ Déchiffrement  │
          │ AES-256-GCM    │
          └─────┬──────────┘
                │
          Réponse client
```

## Thumbnail

```
GET /media/v1/:id/thumbnail
```

Retourne l'aperçu de l'image (200x200).

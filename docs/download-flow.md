# Flux de téléchargement

## Schéma

```
Client ──▶ GET /api/v1/media/:id/download
                │
          ┌─────▼─────┐
          │ Vérif JWT  │
          │ + permissions│
          └─────┬─────┘
                │
          ┌─────▼─────┐
          │ Fetch GCS  │
          └─────┬─────┘
                │
          ┌─────▼──────────┐
          │ Déchiffrement  │
          │ AES-256-GCM    │
          └─────┬──────────┘
                │
          Réponse client
```

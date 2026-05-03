# Health Checks

## Endpoints

```
GET /health   - Santé du service
GET /metrics  - Métriques Prometheus
```

## Composants vérifiés

```
Health
  ├── PostgreSQL ──▶ Connexion OK?
  ├── Redis ──▶ Ping OK?
  └── S3/MinIO ──▶ Bucket accessible?
```

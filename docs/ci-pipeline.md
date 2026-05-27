# Pipeline CI

## Étapes

```
Push ──▶ Lint ──▶ Tests ──▶ Build Docker ──▶ Push GHCR ──▶ SonarCloud
```

Les tests E2E nécessitent PostgreSQL, Redis et MinIO.

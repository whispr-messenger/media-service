# Intégration gRPC modération

## Flux

```
Upload ──▶ Media Service ──▶ gRPC ──▶ Moderation Service
                                           │
                                    Résultat (safe/unsafe)
                                           │
                                    Mise à jour status
                                    en DB
```

Le fichier est stocké immédiatement, la modération est asynchrone.

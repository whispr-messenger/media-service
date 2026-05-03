# URLs présignées

## Fonctionnement

Le media-service génère des URLs présignées S3 pour l'accès direct aux fichiers.

## Flux

```
Client ──▶ GET /media/v1/:id ──▶ Métadonnées + URL présignée
                                        │
                                  URL temporaire
                                  (expiration 15min)
                                        │
Client ──▶ GET <presigned-url> ──▶ Fichier direct depuis S3
```

## Avantages

- Le fichier est servi directement depuis S3, pas via le service
- Réduit la charge sur le media-service
- URL temporaire pour la sécurité

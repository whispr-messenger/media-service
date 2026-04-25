# API Endpoints

Tous les endpoints sont sous le préfixe `/media/v1/`.

## Endpoints

```
POST   /media/v1/upload       - Upload un fichier
GET    /media/v1/quota         - Vérifier son quota
GET    /media/v1/my-media      - Lister ses médias
GET    /media/v1/:id           - Métadonnées d'un média
GET    /media/v1/:id/blob      - Télécharger le fichier
GET    /media/v1/:id/thumbnail - Aperçu (image)
DELETE /media/v1/:id           - Supprimer un média
```

## Health

```
GET /health
GET /metrics
```

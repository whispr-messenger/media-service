# Stratégie de cache

## Redis

Le cache Redis est utilisé pour :
- Métadonnées des fichiers récemment accédés
- URLs signées temporaires
- Résultats de modération

## TTL

| Donnée | TTL |
|--------|-----|
| Métadonnées | 1h |
| URL signée | 15 min |
| Résultat modération | 24h |

## Schéma

```
Requête ──▶ Cache hit? ──▶ oui ──▶ Réponse directe
                │
              non
                │
          Fetch DB/GCS ──▶ Stocker en cache ──▶ Réponse
```

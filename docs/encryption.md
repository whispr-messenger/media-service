# Chiffrement

## AES-256-GCM

Tous les fichiers sont chiffrés avant stockage.

```
Fichier original
     │
     ▼
┌──────────────┐
│ Génération   │
│ IV aléatoire │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Chiffrement  │
│ AES-256-GCM  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Stockage GCS │
│ (fichier     │
│  chiffré)    │
└──────────────┘
```

La clé de chiffrement est stockée dans Vault via la variable `ENCRYPTION_KEY`.

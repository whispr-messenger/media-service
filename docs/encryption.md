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
│ Stockage S3  │
│ (fichier     │
│  chiffré)    │
└──────────────┘
```

La clé de chiffrement est fournie via la variable d'environnement `ENCRYPTION_KEY`.

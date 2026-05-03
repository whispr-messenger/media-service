# Clients gRPC

## Services appelés

```
Media Service
     │
     ├──▶ Auth Service (port 50051)
     │    └── Vérification tokens
     │
     └──▶ Moderation Service (port 50052)
          └── Analyse contenu uploadé
```

## Proto files

Les fichiers `.proto` sont dans le dossier `proto/`.

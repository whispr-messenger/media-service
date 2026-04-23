# Sécurité

## Chiffrement

Tous les fichiers sont chiffrés en AES-256-GCM avant stockage dans S3 (MinIO).

## Authentification

Vérification JWT via JWKS (auth-service).

## Modération

Les fichiers uploadés passent par le moderation-service avant d'être distribués.

## Permissions

Contrôle d'accès par utilisateur et par ressource.

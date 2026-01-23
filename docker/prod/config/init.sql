-- Création de la base de données users_service si elle n'existe pas
SELECT 'CREATE DATABASE media_service'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'media_service')\gexec

-- Utilisation de la base de données
\c media_service;

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour les fonctions cryptographiques
CREATE EXTENSION IF NOT EXISTS pgcrypto;
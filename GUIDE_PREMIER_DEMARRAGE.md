# Premier démarrage du Media Service (développement local)

Ce guide enchaîne les commandes **de la création de la base PostgreSQL** jusqu’au **`npm run start:dev`**, avec Redis et MinIO via Docker.

**Prérequis :**

- [Node.js](https://nodejs.org/) **≥ 22** et npm **≥ 10**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) ou Docker + Compose sur Linux
- [PostgreSQL](https://www.postgresql.org/) **≥ 15** installé et démarré (en local ou accessible sur le réseau)
- `psql` en ligne de commande (souvent fourni avec PostgreSQL)

Les exemples utilisent une base **`whispr_media`** et un rôle applicatif **`media_app`**, comme dans `.env.example`. Adapte les noms si tu changes ton `.env`.

---

## 1. Cloner et installer les dépendances Node

```bash
cd media-service
npm install
```

---

## 2. Fichier d’environnement

```bash
copy .env.example .env
```

Sous PowerShell, si `copy` pose problème :

```powershell
Copy-Item .env.example .env
```

Ouvre `.env` et vérifie au minimum :

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `REDIS_HOST=localhost`, `REDIS_PORT=6379`
- `JWT_JWKS_FILE=scripts/dev/jwks.json` (développement local sans service d’auth distant)
- `S3_ENDPOINT=http://127.0.0.1:9000` (MinIO du `docker-compose.dev.yml`)

**Important :** le mot de passe du rôle `media_app` (étape 5) doit être **le même** que `DB_PASSWORD` une fois que tu passes sur ce rôle.

---

## 3. Créer la base de données PostgreSQL

Connecte-toi en superutilisateur (souvent `postgres`) et crée la base :

```bash
psql -U postgres -c "CREATE DATABASE whispr_media;"
```

Si la base existe déjà, tu peux ignorer cette étape.

---

## 4. Exécuter les migrations TypeORM (en superutilisateur)

Les migrations créent l’extension **`pgcrypto`**, le schéma **`media`**, les tables, les politiques RLS, etc. Cela nécessite en général un utilisateur avec droits suffisants (**`postgres`** ou propriétaire de la base), pas encore le rôle restreint `media_app`.

**PowerShell (Windows) :**

```powershell
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "TON_MOT_DE_PASSE_POSTGRES"
npm run migration:run
Remove-Item Env:DB_USERNAME
Remove-Item Env:DB_PASSWORD
```

**bash (Linux / macOS) :**

```bash
DB_USERNAME=postgres DB_PASSWORD=TON_MOT_DE_PASSE_POSTGRES npm run migration:run
```

Les variables `DB_HOST`, `DB_PORT`, `DB_NAME` sont lues depuis ton `.env` (ou les valeurs par défaut du datasource). Vérifie que `DB_NAME` pointe bien vers `whispr_media`.

> Si une migration échoue, corrige la cause avant de relancer `npm run migration:run` (TypeORM reprend là où il s’est arrêté si besoin).

---

## 5. Créer le rôle applicatif et les droits sur le schéma `media`

L’application refuse de tourner avec le superutilisateur **`postgres`** (RLS). Il faut un rôle dédié, par exemple **`media_app`**.

1. Édite `scripts/create-media-app-role.sql` : mot de passe du `CREATE ROLE` et nom de la base (`GRANT CONNECT ON DATABASE …`) alignés sur ton `.env`.
2. Exécute le script **en tant que superutilisateur** sur la base cible :

```bash
psql -U postgres -d whispr_media -f scripts/create-media-app-role.sql
```

3. Dans ton `.env`, mets :

- `DB_USERNAME=media_app`
- `DB_PASSWORD=` le même mot de passe que dans le script SQL.

> Si tu ajoutes une **nouvelle** migration qui crée des fonctions dans `media` et que tu avais déjà exécuté ce script une seule fois, tu peux devoir redonner les droits, par exemple :  
> `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA media TO media_app;`  
> (à lancer en `psql` en superutilisateur.)

---

## 6. Démarrer Redis et MinIO (Docker)

À la racine du projet :

```bash
npm run dev:stack:up
```

Cela lance **`docker-compose.dev.yml`** (Redis **6379**, MinIO **9000** / console **9001**).

Vérification rapide :

```bash
docker compose -f docker-compose.dev.yml ps
```

Pour arrêter plus tard :

```bash
npm run dev:stack:down
```

---

## 7. Lancer l’API en mode développement

```bash
npm run start:dev
```

L’API écoute en général sur **`http://localhost:3002`** (voir `HTTP_PORT` dans `.env`).

Dans les logs, tu dois voir les routes mappées et, après chargement du JWKS fichier, un message du type chargement réussi de la clé ES256. Swagger : **`http://localhost:3002/media/swagger`**.

---

## 8. (Optionnel) Tester avec Postman

1. Génère un JWT de dev :

   ```bash
   node scripts/dev/mint-dev-jwt.mjs
   ```

2. **GET** `http://localhost:3002/media/v1/health` (sans auth).

3. **POST** `http://localhost:3002/media/v1/upload` : Authorization **Bearer** + token ; body **form-data** avec un champ fichier **`file`**, et **`context`** = `message` (ou supprime `context` pour le défaut).

Plus de détails : `scripts/dev/README.md`.

---

## Récapitulatif des commandes (ordre)

| Étape | Commande |
|--------|----------|
| Dépendances | `npm install` |
| Env | copier `.env.example` → `.env` et éditer |
| Base vide | `psql -U postgres -c "CREATE DATABASE whispr_media;"` |
| Migrations | `DB_USERNAME=postgres DB_PASSWORD=… npm run migration:run` (ou équivalent PowerShell) |
| Rôle + GRANTs | `psql -U postgres -d whispr_media -f scripts/create-media-app-role.sql` puis `.env` → `media_app` |
| Docker | `npm run dev:stack:up` |
| API | `npm run start:dev` |

---

## Dépannage rapide

| Symptôme | Piste |
|----------|--------|
| `droit refusé pour le schéma media` | Réexécuter `create-media-app-role.sql` ou vérifier que `DB_USERNAME` est bien `media_app` avec les bons GRANTs. |
| `ECONNREFUSED` Redis / port 6379 | Lancer `npm run dev:stack:up` ou libérer le port 6379. |
| `ECONNREFUSED` S3 / 9000 | Idem pour MinIO via `dev:stack:up`. |
| JWKS / auth | Vérifier `JWT_JWKS_FILE=scripts/dev/jwks.json` et le chemin depuis la racine du projet. |

Le fichier `scripts/init.sql` du dépôt correspond à un autre schéma / usage ; **la source de vérité du schéma `media` pour ce service est les migrations** dans `src/config/migrations/`.

-- À exécuter en superutilisateur (ex. psql -U postgres -d whispr_media -f scripts/create-media-app-role.sql)
-- Adaptez le mot de passe ou utilisez la même valeur que DB_PASSWORD dans .env

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'media_app') THEN
		CREATE ROLE media_app WITH LOGIN PASSWORD 'whispr' NOSUPERUSER NOCREATEDB NOCREATEROLE;
	END IF;
END
$$;

GRANT CONNECT ON DATABASE whispr_media TO media_app;
GRANT USAGE ON SCHEMA media TO media_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA media TO media_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA media TO media_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA media TO media_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA media GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO media_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA media GRANT USAGE, SELECT ON SEQUENCES TO media_app;
ALTER ROLE media_app SET search_path TO media, public;

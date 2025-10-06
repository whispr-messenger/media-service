-- Initialisation de la base de données media_db

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insertion des catégories de médias par défaut
INSERT INTO media_categories (id, name, description, allowed_types, max_file_size, compression_enabled, preview_enabled) VALUES
  (uuid_generate_v4(), 'image', 'Images (JPEG, PNG, WebP, HEIC)', '["image/jpeg", "image/png", "image/webp", "image/heic"]', 26214400, true, true),
  (uuid_generate_v4(), 'video', 'Vidéos (MP4, MOV, AVI)', '["video/mp4", "video/quicktime", "video/x-msvideo"]', 104857600, true, true),
  (uuid_generate_v4(), 'audio', 'Audio (MP3, WAV, AAC, OGG)', '["audio/mpeg", "audio/wav", "audio/aac", "audio/ogg"]', 52428800, true, true),
  (uuid_generate_v4(), 'document', 'Documents (PDF, DOC, DOCX, TXT)', '["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]', 26214400, false, true),
  (uuid_generate_v4(), 'archive', 'Archives (ZIP, RAR)', '["application/zip", "application/x-rar-compressed"]', 52428800, false, false);

-- Insertion de quelques hashes de modération par défaut (contenu interdit)
INSERT INTO moderation_hashes (id, hash_value, hash_type, status, reason) VALUES
  (uuid_generate_v4(), 'blocked_content_hash_1', 'perceptual', 'blocked', 'Contenu inapproprié'),
  (uuid_generate_v4(), 'blocked_content_hash_2', 'md5', 'blocked', 'Malware détecté'),
  (uuid_generate_v4(), 'blocked_content_hash_3', 'perceptual', 'blocked', 'Contenu violent');

-- Index pour optimiser les performances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_user_created ON media (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_conversation_message ON media (conversation_id, message_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_moderation_active ON media (moderation_hash, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_quotas_date ON user_quotas (user_id, quota_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_logs_user_date ON media_access_logs (user_id, accessed_at DESC);

-- Fonction pour nettoyer les fichiers expirés
CREATE OR REPLACE FUNCTION cleanup_expired_media()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE media 
    SET is_active = false 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les quotas utilisateur
CREATE OR REPLACE FUNCTION update_user_quota(
    p_user_id UUID,
    p_file_size BIGINT,
    p_operation VARCHAR(10) -- 'add' ou 'remove'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_quotas (id, user_id, storage_used, files_count, quota_date)
    VALUES (uuid_generate_v4(), p_user_id, 
            CASE WHEN p_operation = 'add' THEN p_file_size ELSE 0 END,
            CASE WHEN p_operation = 'add' THEN 1 ELSE 0 END,
            CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE SET
        storage_used = CASE 
            WHEN p_operation = 'add' THEN user_quotas.storage_used + p_file_size
            ELSE user_quotas.storage_used - p_file_size
        END,
        files_count = CASE 
            WHEN p_operation = 'add' THEN user_quotas.files_count + 1
            ELSE user_quotas.files_count - 1
        END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement les quotas
CREATE OR REPLACE FUNCTION trigger_update_quota()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_user_quota(NEW.user_id, NEW.file_size, 'add');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_user_quota(OLD.user_id, OLD.file_size, 'remove');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_quota_trigger
    AFTER INSERT OR DELETE ON media
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_quota();

-- Vue pour les statistiques de médias
CREATE OR REPLACE VIEW media_stats AS
SELECT 
    mc.name as category,
    COUNT(*) as total_files,
    SUM(m.file_size) as total_size,
    AVG(m.file_size) as avg_size,
    COUNT(CASE WHEN m.is_compressed THEN 1 END) as compressed_files
FROM media m
JOIN media_categories mc ON m.category_id = mc.id
WHERE m.is_active = true
GROUP BY mc.name;

-- Permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO media_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO media_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO media_user;
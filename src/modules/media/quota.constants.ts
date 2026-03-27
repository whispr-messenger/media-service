/**
 * Single source of truth for per-user quota default values.
 *
 * These constants are used by:
 *  - UserQuota entity column defaults (TypeORM @Column default)
 *  - QuotaService when building new quota rows
 *
 * Keeping them in one place prevents drift between the service layer,
 * the entity, and any future migrations that change defaults.
 */

/** Default storage limit per user: 1 GiB (in bytes) */
export const DEFAULT_STORAGE_LIMIT_BYTES = 1_073_741_824;

/** Default maximum number of stored files per user */
export const DEFAULT_FILES_LIMIT = 1_000;

/** Default maximum number of uploads allowed per day per user */
export const DEFAULT_DAILY_UPLOAD_LIMIT = 100;

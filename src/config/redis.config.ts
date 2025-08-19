export const redisConfig = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'media:',
  ttl: {
    quota: parseInt(process.env.REDIS_QUOTA_TTL, 10) || 3600, // 1 hour
    preview: parseInt(process.env.REDIS_PREVIEW_TTL, 10) || 86400, // 24 hours
    metadata: parseInt(process.env.REDIS_METADATA_TTL, 10) || 1800, // 30 minutes
  },
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true,
});

export type RedisConfig = ReturnType<typeof redisConfig>;
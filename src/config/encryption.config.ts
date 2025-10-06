export const encryptionConfig = () => ({
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 32,
  iterations: 100000,
  masterKey:
    process.env.ENCRYPTION_KEY || 'your-encryption-key-change-in-production',
  keyDerivation: {
    algorithm: 'pbkdf2',
    digest: 'sha256',
  },
});

export type EncryptionConfig = ReturnType<typeof encryptionConfig>;

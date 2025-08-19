import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import * as crypto from 'crypto';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'encryption.algorithm': 'aes-256-gcm',
                'encryption.keyLength': 32,
                'encryption.ivLength': 16,
                'encryption.tagLength': 16,
                'encryption.saltLength': 32,
                'encryption.iterations': 100000,
                'encryption.masterKey': 'test-master-key-32-characters-long'
              };
              return config[key] || null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encryptBuffer', () => {
    it('should encrypt buffer successfully', async () => {
      const testData = Buffer.from('Hello, World!');
      const userKey = 'test-user-key';
      const result = service.encryptBuffer(testData, userKey);

      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result).toHaveProperty('salt');
      expect(result.encryptedData).toBeInstanceOf(Buffer);
      expect(result.iv).toBeInstanceOf(Buffer);
      expect(result.tag).toBeInstanceOf(Buffer);
      expect(result.salt).toBeInstanceOf(Buffer);
    });

    it('should produce different results for same input', async () => {
      const testData = Buffer.from('Hello, World!');
      const userKey = 'test-user-key';
      const result1 = service.encryptBuffer(testData, userKey);
      const result2 = service.encryptBuffer(testData, userKey);

      expect(result1.encryptedData).not.toEqual(result2.encryptedData);
      expect(result1.salt).not.toEqual(result2.salt);
      expect(result1.iv).not.toEqual(result2.iv);
    });
  });

  describe('decryptBuffer', () => {
    it('should decrypt data successfully', async () => {
      const testData = Buffer.from('Hello, World!');
      const userKey = 'test-user-key';
      const encrypted = service.encryptBuffer(testData, userKey);
      
      const decrypted = service.decryptBuffer({
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        tag: encrypted.tag,
        salt: encrypted.salt,
        userKey: userKey
      });

      expect(decrypted).toEqual(testData);
    });

    it('should throw error with invalid key', async () => {
      const testData = Buffer.from('Hello, World!');
      const userKey = 'test-user-key';
      const encrypted = service.encryptBuffer(testData, userKey);
      const invalidKey = 'invalid-key';

      expect(() => {
        service.decryptBuffer({
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          tag: encrypted.tag,
          salt: encrypted.salt,
          userKey: invalidKey
        });
      }).toThrow();
    });

    it('should throw error with invalid IV', async () => {
      const testData = Buffer.from('Hello, World!');
      const userKey = 'test-user-key';
      const encrypted = service.encryptBuffer(testData, userKey);
      const invalidIv = crypto.randomBytes(16);

      expect(() => {
        service.decryptBuffer({
          encryptedData: encrypted.encryptedData,
          iv: invalidIv,
          tag: encrypted.tag,
          salt: encrypted.salt,
          userKey: userKey
        });
      }).toThrow();
    });
  });

  describe('generateFileHash', () => {
    it('should generate consistent hash for same data', () => {
      const testData = Buffer.from('Hello, World!');
      const hash1 = service.generateFileHash(testData);
      const hash2 = service.generateFileHash(testData);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex encoded
    });

    it('should generate different hashes for different data', () => {
      const data1 = Buffer.from('Hello, World!');
      const data2 = Buffer.from('Goodbye, World!');
      const hash1 = service.generateFileHash(data1);
      const hash2 = service.generateFileHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });


});
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: Buffer;
  tag: Buffer;
  salt: Buffer;
}

export interface DecryptionParams {
  encryptedData: Buffer;
  iv: Buffer;
  tag: Buffer;
  salt: Buffer;
  userKey: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm: string;
  private readonly keyLength: number;
  private readonly ivLength: number;
  private readonly tagLength: number;
  private readonly saltLength: number;
  private readonly iterations: number;
  private readonly masterKey: string;

  constructor(private readonly configService: ConfigService) {
    this.algorithm = this.configService.get<string>('encryption.algorithm');
    this.keyLength = this.configService.get<number>('encryption.keyLength');
    this.ivLength = this.configService.get<number>('encryption.ivLength');
    this.tagLength = this.configService.get<number>('encryption.tagLength');
    this.saltLength = this.configService.get<number>('encryption.saltLength');
    this.iterations = this.configService.get<number>('encryption.iterations');
    this.masterKey = this.configService.get<string>('encryption.masterKey');
  }

  private deriveKey(userKey: string, salt: Buffer): Buffer {
    const combinedKey = `${this.masterKey}:${userKey}`;
    return crypto.pbkdf2Sync(combinedKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  async encryptFile(filePath: string, userKey: string): Promise<EncryptionResult> {
    try {
      const data = await fs.readFile(filePath);
      return this.encryptBuffer(data, userKey);
    } catch (error) {
      this.logger.error(`Erreur lors du chiffrement du fichier ${filePath}:`, error);
      throw new Error('Échec du chiffrement du fichier');
    }
  }

  encryptBuffer(data: Buffer, userKey: string): EncryptionResult {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.deriveKey(userKey, salt);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
      cipher.setAAD(salt);

      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);

      const tag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv,
        tag,
        salt
      };
    } catch (error) {
      this.logger.error('Erreur lors du chiffrement:', error);
      throw new Error('Échec du chiffrement des données');
    }
  }

  async decryptFile(params: DecryptionParams, outputPath: string): Promise<void> {
    try {
      const decryptedData = this.decryptBuffer(params);
      await fs.writeFile(outputPath, decryptedData);
    } catch (error) {
      this.logger.error(`Erreur lors du déchiffrement vers ${outputPath}:`, error);
      throw new Error('Échec du déchiffrement du fichier');
    }
  }

  decryptBuffer(params: DecryptionParams): Buffer {
    try {
      const { encryptedData, iv, tag, salt, userKey } = params;
      const key = this.deriveKey(userKey, salt);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(tag);
      decipher.setAAD(salt);

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);

      return decrypted;
    } catch (error) {
      this.logger.error('Erreur lors du déchiffrement:', error);
      throw new Error('Échec du déchiffrement des données');
    }
  }

  generateFileHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async generateFileHashFromPath(filePath: string): Promise<string> {
    try {
      const data = await fs.readFile(filePath);
      return this.generateFileHash(data);
    } catch (error) {
      this.logger.error(`Erreur lors du calcul du hash pour ${filePath}:`, error);
      throw new Error('Échec du calcul du hash du fichier');
    }
  }

  verifyIntegrity(originalHash: string, data: Buffer): boolean {
    const currentHash = this.generateFileHash(data);
    return originalHash === currentHash;
  }

  async createEncryptedMetadata(metadata: any, userKey: string): Promise<string> {
    try {
      const jsonData = JSON.stringify(metadata);
      const buffer = Buffer.from(jsonData, 'utf8');
      const encrypted = this.encryptBuffer(buffer, userKey);
      
      const combined = {
        data: encrypted.encryptedData.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        tag: encrypted.tag.toString('base64'),
        salt: encrypted.salt.toString('base64')
      };
      
      return Buffer.from(JSON.stringify(combined)).toString('base64');
    } catch (error) {
      this.logger.error('Erreur lors du chiffrement des métadonnées:', error);
      throw new Error('Échec du chiffrement des métadonnées');
    }
  }

  async decryptMetadata(encryptedMetadata: string, userKey: string): Promise<any> {
    try {
      const combined = JSON.parse(Buffer.from(encryptedMetadata, 'base64').toString('utf8'));
      
      const params: DecryptionParams = {
        encryptedData: Buffer.from(combined.data, 'base64'),
        iv: Buffer.from(combined.iv, 'base64'),
        tag: Buffer.from(combined.tag, 'base64'),
        salt: Buffer.from(combined.salt, 'base64'),
        userKey
      };
      
      const decrypted = this.decryptBuffer(params);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      this.logger.error('Erreur lors du déchiffrement des métadonnées:', error);
      throw new Error('Échec du déchiffrement des métadonnées');
    }
  }
}
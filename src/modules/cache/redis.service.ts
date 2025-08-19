import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export interface UserQuota {
  userId: string;
  totalSize: number;
  fileCount: number;
  lastUpdated: Date;
}

export interface MediaMetadata {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  userId: string;
  categoryId: string;
  uploadedAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private readonly defaultTTL = 3600; // 1 heure en secondes

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Trop de tentatives de reconnexion Redis, abandon');
            return new Error('Trop de tentatives de reconnexion');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.client.on('error', (error) => {
      this.logger.error('Erreur Redis:', error);
    });

    this.client.on('connect', () => {
      this.logger.log('Connexion à Redis établie');
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Connexion à Redis fermée');
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Service Redis initialisé avec succès');
    } catch (error) {
      this.logger.error('Erreur lors de l\'initialisation de Redis:', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Connexion Redis fermée proprement');
    } catch (error) {
      this.logger.error('Erreur lors de la fermeture de Redis:', error);
    }
  }

  // Gestion des quotas utilisateur
  async getUserQuota(userId: string): Promise<UserQuota | null> {
    try {
      const key = `quota:${userId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      const quota = JSON.parse(data);
      return {
        ...quota,
        lastUpdated: new Date(quota.lastUpdated)
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du quota pour ${userId}:`, error);
      return null;
    }
  }

  async setUserQuota(quota: UserQuota, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const key = `quota:${quota.userId}`;
      const data = JSON.stringify({
        ...quota,
        lastUpdated: new Date(),
      });
      
      await this.client.setEx(key, ttl, data);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde du quota pour ${quota.userId}:`, error);
      return false;
    }
  }

  async updateUserQuota(userId: string, sizeChange: number, fileCountChange: number): Promise<boolean> {
    try {
      const currentQuota = await this.getUserQuota(userId);
      
      const updatedQuota: UserQuota = {
        userId,
        totalSize: (currentQuota?.totalSize || 0) + sizeChange,
        fileCount: (currentQuota?.fileCount || 0) + fileCountChange,
        lastUpdated: new Date(),
      };

      return await this.setUserQuota(updatedQuota);
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour du quota pour ${userId}:`, error);
      return false;
    }
  }

  async deleteUserQuota(userId: string): Promise<boolean> {
    try {
      const key = `quota:${userId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression du quota pour ${userId}:`, error);
      return false;
    }
  }

  // Gestion des métadonnées de médias
  async getMediaMetadata(mediaId: string): Promise<MediaMetadata | null> {
    try {
      const key = `media:${mediaId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      const metadata = JSON.parse(data);
      // Convertir les dates
      metadata.uploadedAt = new Date(metadata.uploadedAt);
      if (metadata.expiresAt) {
        metadata.expiresAt = new Date(metadata.expiresAt);
      }

      return metadata;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des métadonnées pour ${mediaId}:`, error);
      return null;
    }
  }

  async setMediaMetadata(metadata: MediaMetadata, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const key = `media:${metadata.id}`;
      const data = JSON.stringify(metadata);
      
      await this.client.setEx(key, ttl, data);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde des métadonnées pour ${metadata.id}:`, error);
      return false;
    }
  }

  async deleteMediaMetadata(mediaId: string): Promise<boolean> {
    try {
      const key = `media:${mediaId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression des métadonnées pour ${mediaId}:`, error);
      return false;
    }
  }

  // Gestion des sessions de téléchargement temporaires
  async createDownloadSession(mediaId: string, userId: string, expiresIn: number = 300): Promise<string> {
    try {
      const sessionId = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const key = `download:${sessionId}`;
      const data = JSON.stringify({ mediaId, userId, createdAt: new Date() });
      
      await this.client.setEx(key, expiresIn, data);
      return sessionId;
    } catch (error) {
      this.logger.error('Erreur lors de la création de session de téléchargement:', error);
      throw error;
    }
  }

  async getDownloadSession(sessionId: string): Promise<{ mediaId: string; userId: string; createdAt: Date } | null> {
    try {
      const key = `download:${sessionId}`;
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      const session = JSON.parse(data);
      session.createdAt = new Date(session.createdAt);
      return session;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de session ${sessionId}:`, error);
      return null;
    }
  }

  async deleteDownloadSession(sessionId: string): Promise<boolean> {
    try {
      const key = `download:${sessionId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression de session ${sessionId}:`, error);
      return false;
    }
  }

  // Utilitaires génériques
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const data = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.setEx(key, ttl, data);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde de ${key}:`, error);
      return false;
    }
  }

  async get(key: string): Promise<any> {
    try {
      const data = await this.client.get(key);
      if (!data) {
        return null;
      }

      try {
        return JSON.parse(data);
      } catch {
        return data; // Retourner la chaîne si ce n'est pas du JSON
      }
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression de ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Erreur lors de la vérification d'existence de ${key}:`, error);
      return false;
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      await this.client.flushAll();
      this.logger.log('Cache Redis vidé');
      return true;
    } catch (error) {
      this.logger.error('Erreur lors du vidage du cache:', error);
      return false;
    }
  }

  // Vérification de santé
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Erreur lors du health check Redis:', error);
      return false;
    }
  }
}
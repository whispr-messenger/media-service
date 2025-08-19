import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { StorageService } from '../storage/storage.service';
import { ModerationClient } from '../grpc/moderation.client';
import { RedisService } from '../cache/redis.service';
import * as sharp from 'sharp';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
// Types simplifiés pour éviter les problèmes avec Prisma
export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: bigint;
  isCompressed: boolean;
  uploadedAt: Date;
  expiresAt?: Date;
  userId: string;
  conversationId?: string;
  messageId?: string;
  categoryId?: string;
  isTemporary: boolean;
  encryptionKey: string;
  storageUrl: string;
  fileHash: string;
}

export interface MediaCategory {
  id: string;
  name: string;
  description?: string;
  allowedTypes: any; // JsonValue from Prisma
  maxFileSize: bigint;
  compressionEnabled: boolean;
  previewEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaWithCategory extends Media {
  category?: MediaCategory;
}

export interface MediaCategoryWithCount extends MediaCategory {
  _count: { media: number };
}

export interface UploadFileDto {
  file: Express.Multer.File;
  userId: string;
  conversationId?: string;
  messageId?: string;
  categoryId?: string;
  isTemporary?: boolean;
  expiresAt?: Date;
}

export interface MediaResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  isCompressed: boolean;
  hasPreview: boolean;
  uploadedAt: Date;
  expiresAt?: Date;
  downloadUrl: string;
  previewUrl?: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadPath: string;
  private readonly tempPath: string;
  private readonly maxFileSizes: Record<string, number>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly storageService: StorageService,
    private readonly moderationClient: ModerationClient,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.uploadPath = this.configService.get<string>('storage.uploadPath');
    this.tempPath = this.configService.get<string>('storage.tempPath');
    this.maxFileSizes = {
      image: this.configService.get<number>('storage.maxImageSize'),
      video: this.configService.get<number>('storage.maxVideoSize'),
      audio: this.configService.get<number>('storage.maxAudioSize'),
      document: this.configService.get<number>('storage.maxDocumentSize'),
      default: this.configService.get<number>('storage.maxFileSize'),
    };
  }

  async uploadFile(uploadDto: UploadFileDto): Promise<MediaResponse> {
    const { file, userId, conversationId, messageId, categoryId, isTemporary, expiresAt } = uploadDto;

    try {
      // Validation de la taille du fichier
      await this.validateFileSize(file, categoryId);

      // Détermination de la catégorie
      const category = await this.determineCategory(file.mimetype, categoryId);
      
      // Génération des chemins et noms de fichiers
      const fileId = crypto.randomUUID();
      const fileExtension = path.extname(file.originalname);
      const filename = `${fileId}${fileExtension}`;
      const tempFilePath = path.join(this.tempPath, filename);
      
      // Sauvegarde temporaire du fichier
      await fs.writeFile(tempFilePath, file.buffer);
      
      // Calcul du hash pour l'intégrité
      const fileHash = this.encryptionService.generateFileHash(file.buffer);
      
      // Vérification de modération (hash)
      await this.checkModerationHash(fileHash);
      
      // Vérification de modération via gRPC si disponible
      try {
        // TODO: Intégrer le client gRPC de modération
        // const moderationCheck = await this.moderationClient.checkContent({
        //   contentId: fileId,
        //   contentType: file.mimetype,
        //   fileHash,
        //   contentData: file.buffer,
        //   userId,
        // });
        // 
        // if (!moderationCheck.approved && moderationCheck.status === 'rejected') {
        //   throw new BadRequestException(`Contenu rejeté par la modération: ${moderationCheck.reason}`);
        // }
      } catch (error) {
        this.logger.warn('Erreur lors de la vérification de modération:', error);
      }
      
      // Compression si nécessaire
      let processedBuffer = file.buffer;
      let isCompressed = false;
      
      if (category.compressionEnabled) {
        const compressed = await this.compressFile(tempFilePath, file.mimetype);
        if (compressed) {
          processedBuffer = compressed;
          isCompressed = true;
        }
      }
      
      // Chiffrement du fichier
      const encryptionResult = this.encryptionService.encryptBuffer(processedBuffer, userId);
      
      // Génération de preview si nécessaire
      let previewData: Buffer | null = null;
      if (category.previewEnabled) {
        previewData = await this.generatePreview(tempFilePath, file.mimetype);
      }
      
      // Sauvegarde en base de données
      const media = await this.prisma.media.create({
        data: {
          id: fileId,
          userId,
          conversationId,
          messageId,
          categoryId: category.id,
          originalFilename: file.originalname,
          contentType: file.mimetype,
          fileSize: BigInt(processedBuffer.length),
          storagePath: `media/${fileId}`,
          encryptionKeyHash: crypto.createHash('sha256').update(userId).digest('hex'),
          moderationHash: fileHash,
          isCompressed,
          expiresAt,
        },
      });
      
      // Sauvegarde de la preview si générée
      if (previewData && category.previewEnabled) {
        const previewEncryption = this.encryptionService.encryptBuffer(previewData, userId);
        const previewPath = `previews/${fileId}-preview`;
        
        await this.storageService.uploadFile({
          fileName: previewPath,
          buffer: previewEncryption.encryptedData,
          contentType: this.getPreviewType(file.mimetype) === 'image' ? 'image/jpeg' : 'video/mp4',
        });
        
        await this.prisma.mediaPreview.create({
          data: {
            id: crypto.randomUUID(),
            mediaId: fileId,
            previewType: this.getPreviewType(file.mimetype),
            storagePath: previewPath,
            contentType: this.getPreviewType(file.mimetype) === 'image' ? 'image/jpeg' : 'video/mp4',
            fileSize: BigInt(previewData.length),
            metadata: {
              encryptionIv: previewEncryption.iv.toString('base64'),
              encryptionTag: previewEncryption.tag.toString('base64'),
              encryptionSalt: previewEncryption.salt.toString('base64'),
            },
          },
        });
      }
      
      // Nettoyage du fichier temporaire
      await fs.unlink(tempFilePath).catch(() => {});
      
      // Upload du fichier chiffré vers le stockage
      const storagePath = `media/${userId}/${filename}`;
      await this.storageService.uploadFile({
        fileName: storagePath,
        buffer: encryptionResult.encryptedData,
        contentType: file.mimetype,
      });

      // Mise à jour des quotas utilisateur
      await this.updateUserQuota(userId, processedBuffer.length, 'add');
      
      const mediaFormatted = {
        id: media.id,
        filename: media.originalFilename,
        originalName: media.originalFilename,
        mimeType: media.contentType,
          fileSize: Number(media.fileSize),
          isCompressed: media.isCompressed,
          uploadedAt: media.createdAt,
        expiresAt: media.expiresAt,
        userId: media.userId,
        conversationId: media.conversationId,
        messageId: media.messageId,
        categoryId: media.categoryId,
        isTemporary: false,
          encryptionKey: media.encryptionKeyHash,
          storageUrl: media.storagePath,
          fileHash: media.moderationHash,
      };
      
      return this.formatMediaResponse(media, category.previewEnabled && !!previewData);
      
    } catch (error) {
      this.logger.error(`Erreur lors de l'upload du fichier pour l'utilisateur ${userId}:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Échec de l\'upload du fichier');
    }
  }

  async getMedia(mediaId: string, userId: string): Promise<Buffer> {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        isActive: true,
      },
    });

    if (!media) {
      throw new NotFoundException('Média non trouvé');
    }

    // Vérifier que l'utilisateur a le droit d'accéder à ce média
    if (media.userId !== userId) {
      // Vérifier si le média est partagé avec cet utilisateur
      const sharedMedia = await this.prisma.mediaShare?.findFirst({
        where: {
          mediaId,
          sharedWith: userId,
          expiresAt: {
            gt: new Date(),
          },
        },
      }).catch(() => null);

      if (!sharedMedia) {
        throw new ForbiddenException('Accès non autorisé à ce média');
      }
    }

    // Vérification de l'expiration
    if (media.expiresAt && media.expiresAt < new Date()) {
      throw new BadRequestException('Média expiré');
    }

    // TODO: Récupérer le fichier chiffré depuis le stockage et le déchiffrer
    // Pour l'instant, on retourne un buffer vide
    return Buffer.alloc(0);
  }

  async deleteMedia(mediaId: string, userId: string): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        isActive: true,
      },
    });

    if (!media) {
      throw new NotFoundException('Média non trouvé');
    }

    // Vérifier que l'utilisateur est propriétaire du média
    if (media.userId !== userId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres médias');
    }

    // Soft delete
    await this.prisma.media.update({
      where: { id: mediaId },
      data: { isActive: false },
    });

    // Mise à jour des quotas
    await this.updateUserQuota(userId, Number(media.fileSize), 'remove');

    this.logger.log(`Média ${mediaId} supprimé pour l'utilisateur ${userId}`);
  }

  private async validateFileSize(file: Express.Multer.File, categoryId?: string): Promise<void> {
    const category = categoryId ? await this.prisma.mediaCategory.findUnique({ where: { id: categoryId } }) : null;
    const maxSize = category?.maxFileSize || this.maxFileSizes.default;

    if (file.size > maxSize) {
      throw new BadRequestException(`Fichier trop volumineux. Taille maximale: ${maxSize} bytes`);
    }
  }

  private async determineCategory(mimeType: string, categoryId?: string): Promise<MediaCategory> {
    if (categoryId) {
      const category = await this.prisma.mediaCategory.findUnique({ where: { id: categoryId } });
      if (category) return category;
    }

    // Détermination automatique basée sur le MIME type
    const categories = await this.prisma.mediaCategory.findMany();
    
    for (const category of categories) {
      const allowedTypes = category.allowedTypes as string[];
      if (allowedTypes.includes(mimeType)) {
        return category;
      }
    }

    // Catégorie par défaut
    const defaultCategory = categories.find(c => c.name === 'document');
    if (!defaultCategory) {
      throw new BadRequestException('Aucune catégorie appropriée trouvée');
    }

    return defaultCategory;
  }

  private async checkModerationHash(fileHash: string): Promise<void> {
    const blockedHash = await this.prisma.moderationHash.findFirst({
      where: {
        hashValue: fileHash,
        status: 'blocked',
      },
    });

    if (blockedHash) {
      throw new BadRequestException('Fichier bloqué par la modération');
    }
  }

  private async compressFile(filePath: string, mimeType: string): Promise<Buffer | null> {
    try {
      if (mimeType.startsWith('image/')) {
        return await this.compressImage(filePath);
      } else if (mimeType.startsWith('video/')) {
        return await this.compressVideo(filePath);
      }
      return null;
    } catch (error) {
      this.logger.warn(`Échec de la compression pour ${filePath}:`, error);
      return null;
    }
  }

  private async compressImage(filePath: string): Promise<Buffer> {
    return sharp(filePath)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  }

  private async compressVideo(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const outputPath = `${filePath}.compressed.mp4`;
      
      ffmpeg(filePath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .videoBitrate('1000k')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            await fs.unlink(outputPath).catch(() => {});
            resolve(buffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
  }

  private async generatePreview(filePath: string, mimeType: string): Promise<Buffer | null> {
    try {
      if (mimeType.startsWith('image/')) {
        return await this.generateImagePreview(filePath);
      } else if (mimeType.startsWith('video/')) {
        return await this.generateVideoPreview(filePath);
      }
      return null;
    } catch (error) {
      this.logger.warn(`Échec de la génération de preview pour ${filePath}:`, error);
      return null;
    }
  }

  private async generateImagePreview(filePath: string): Promise<Buffer> {
    return sharp(filePath)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  private async generateVideoPreview(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const outputPath = `${filePath}.preview.jpg`;
      
      ffmpeg(filePath)
        .screenshots({
          count: 1,
          folder: path.dirname(outputPath),
          filename: path.basename(outputPath),
          size: '300x300'
        })
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            await fs.unlink(outputPath).catch(() => {});
            resolve(buffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private getPreviewType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'thumbnail';
    if (mimeType.startsWith('video/')) return 'thumbnail';
    if (mimeType.startsWith('audio/')) return 'waveform';
    return 'icon';
  }

  private async updateUserQuota(userId: string, fileSize: number, operation: 'add' | 'remove'): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const quota = await this.prisma.userQuota.findUnique({
      where: { userId },
    });

    if (quota) {
      await this.prisma.userQuota.update({
        where: { userId },
        data: {
          storageUsed: operation === 'add' 
            ? Number(quota.storageUsed) + fileSize
            : Math.max(0, Number(quota.storageUsed) - fileSize),
          filesCount: operation === 'add' 
            ? quota.filesCount + 1 
            : Math.max(0, quota.filesCount - 1),
        },
      });
    } else {
      await this.prisma.userQuota.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          storageUsed: operation === 'add' ? fileSize : 0,
          filesCount: operation === 'add' ? 1 : 0,
          quotaDate: today,
        },
      });
    }
  }

  private formatMediaResponse(media: any, hasPreview: boolean): MediaResponse {
    return {
      id: media.id,
      filename: media.originalFilename,
      originalName: media.originalFilename,
      mimeType: media.contentType,
      fileSize: Number(media.fileSize),
      isCompressed: media.isCompressed,
      hasPreview,
      uploadedAt: media.createdAt,
      expiresAt: media.expiresAt,
      downloadUrl: `/api/v1/media/${media.id}/download`,
      previewUrl: hasPreview ? `/api/v1/media/${media.id}/preview` : undefined,
    };
  }
}
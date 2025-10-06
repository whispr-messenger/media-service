import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

export interface StorageUploadOptions {
  fileName: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageDownloadResult {
  buffer: Buffer;
  metadata?: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly projectId: string;

  constructor(private readonly configService: ConfigService) {
    this.projectId = this.configService.get<string>('storage.gcs.projectId');
    this.bucketName = this.configService.get<string>('storage.gcs.bucketName');

    const keyFilename = this.configService.get<string>(
      'storage.gcs.keyFilename',
    );

    this.storage = new Storage({
      projectId: this.projectId,
      keyFilename,
    });
  }

  async uploadFile(options: StorageUploadOptions): Promise<string> {
    const { fileName, buffer, contentType, metadata } = options;

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const stream = file.createWriteStream({
        metadata: {
          contentType: contentType || 'application/octet-stream',
          metadata: metadata || {},
        },
        resumable: false,
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          this.logger.error(
            `Erreur lors de l'upload vers GCS: ${error.message}`,
            error,
          );
          reject(
            new InternalServerErrorException(
              "Échec de l'upload vers le stockage",
            ),
          );
        });

        stream.on('finish', () => {
          this.logger.log(`Fichier ${fileName} uploadé avec succès vers GCS`);
          resolve(fileName);
        });

        stream.end(buffer);
      });
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'upload du fichier ${fileName}:`,
        error,
      );
      throw new InternalServerErrorException(
        "Échec de l'upload vers le stockage",
      );
    }
  }

  async downloadFile(fileName: string): Promise<StorageDownloadResult> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`Fichier ${fileName} non trouvé dans le stockage`);
      }

      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();

      this.logger.log(`Fichier ${fileName} téléchargé avec succès depuis GCS`);

      return {
        buffer,
        metadata: metadata.metadata || {},
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du téléchargement du fichier ${fileName}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Échec du téléchargement depuis le stockage',
      );
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.delete();
      this.logger.log(`Fichier ${fileName} supprimé avec succès de GCS`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du fichier ${fileName}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Échec de la suppression du fichier',
      );
    }
  }

  async fileExists(fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification d'existence du fichier ${fileName}:`,
        error,
      );
      return false;
    }
  }

  async getFileMetadata(fileName: string): Promise<Record<string, string>> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [metadata] = await file.getMetadata();
      return metadata.metadata || {};
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des métadonnées du fichier ${fileName}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Échec de la récupération des métadonnées',
      );
    }
  }

  generateStoragePath(
    userId: string,
    fileId: string,
    extension: string,
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Structure: users/{userId}/{year}/{month}/{day}/{fileId}.{extension}
    return `users/${userId}/${year}/${month}/${day}/${fileId}${extension}`;
  }

  generatePreviewPath(userId: string, fileId: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // Structure: previews/{userId}/{year}/{month}/{day}/{fileId}.jpg
    return `previews/${userId}/${year}/${month}/${day}/${fileId}.jpg`;
  }

  async uploadEncryptedFile(
    userId: string,
    fileId: string,
    encryptedBuffer: Buffer,
    originalExtension: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const storagePath = this.generateStoragePath(userId, fileId, '.enc');

    const uploadOptions: StorageUploadOptions = {
      fileName: storagePath,
      buffer: encryptedBuffer,
      contentType: 'application/octet-stream',
      metadata: {
        ...metadata,
        originalExtension,
        encrypted: 'true',
        userId,
        fileId,
      },
    };

    return this.uploadFile(uploadOptions);
  }

  async uploadEncryptedPreview(
    userId: string,
    fileId: string,
    encryptedPreviewBuffer: Buffer,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const previewPath = this.generatePreviewPath(userId, fileId);

    const uploadOptions: StorageUploadOptions = {
      fileName: previewPath,
      buffer: encryptedPreviewBuffer,
      contentType: 'application/octet-stream',
      metadata: {
        ...metadata,
        encrypted: 'true',
        preview: 'true',
        userId,
        fileId,
      },
    };

    return this.uploadFile(uploadOptions);
  }

  async cleanupExpiredFiles(): Promise<number> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles();

      let deletedCount = 0;
      const now = new Date();

      for (const file of files) {
        try {
          const [metadata] = await file.getMetadata();
          const expiresAt = metadata.metadata?.expiresAt;

          if (expiresAt && new Date(expiresAt) < now) {
            await file.delete();
            deletedCount++;
            this.logger.log(`Fichier expiré supprimé: ${file.name}`);
          }
        } catch (error) {
          this.logger.warn(
            `Erreur lors de la vérification d'expiration pour ${file.name}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Nettoyage terminé: ${deletedCount} fichiers expirés supprimés`,
      );
      return deletedCount;
    } catch (error) {
      this.logger.error(
        'Erreur lors du nettoyage des fichiers expirés:',
        error,
      );
      throw new InternalServerErrorException(
        'Échec du nettoyage des fichiers expirés',
      );
    }
  }
}

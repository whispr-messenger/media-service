import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

export interface CheckContentRequest {
  contentId: string;
  contentType: string;
  fileHash: string;
  contentData?: Buffer;
  userId: string;
}

export interface CheckContentResponse {
  approved: boolean;
  status: string; // approved, rejected, pending
  reason?: string;
  flags: string[];
  moderationId: string;
  error?: string;
}

export interface ReportContentRequest {
  contentId: string;
  reporterId: string;
  reason: string;
  description: string;
}

export interface ReportContentResponse {
  reportId: string;
  success: boolean;
  error?: string;
}

export interface GetModerationStatusRequest {
  contentId: string;
}

export interface GetModerationStatusResponse {
  contentId: string;
  status: string;
  reason?: string;
  checkedAt: number;
  moderatorId?: string;
  error?: string;
}

export interface AddBlockedHashRequest {
  hashValue: string;
  hashType: string; // md5, sha256, perceptual
  reason: string;
  addedBy: string;
}

export interface AddBlockedHashResponse {
  success: boolean;
  hashId: string;
  error?: string;
}

@Injectable()
export class ModerationClient implements OnModuleInit {
  private readonly logger = new Logger(ModerationClient.name);
  private client: any;
  private readonly moderationServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.moderationServiceUrl = this.configService.get<string>(
      'grpc.moderationService.url',
      'localhost:50052',
    );
  }

  async onModuleInit() {
    try {
      const protoPath = path.join(__dirname, '../../../proto/moderation.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const moderationProto = grpc.loadPackageDefinition(packageDefinition)
        .moderation as any;

      this.client = new moderationProto.ModerationService(
        this.moderationServiceUrl,
        grpc.credentials.createInsecure(),
      );

      this.logger.log(
        `Client gRPC Moderation connecté à ${this.moderationServiceUrl}`,
      );
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'initialisation du client Moderation gRPC:",
        error,
      );
    }
  }

  async checkContent(
    request: CheckContentRequest,
  ): Promise<CheckContentResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Moderation non initialisé'));
        return;
      }

      const grpcRequest = {
        content_id: request.contentId,
        content_type: request.contentType,
        file_hash: request.fileHash,
        content_data: request.contentData,
        user_id: request.userId,
      };

      this.client.CheckContent(grpcRequest, (error: any, response: any) => {
        if (error) {
          this.logger.error(
            'Erreur lors de la vérification du contenu:',
            error,
          );
          resolve({
            approved: false,
            status: 'error',
            reason: error.message,
            flags: [],
            moderationId: '',
            error: error.message,
          });
        } else {
          resolve({
            approved: response.approved,
            status: response.status,
            reason: response.reason,
            flags: response.flags || [],
            moderationId: response.moderation_id,
            error: response.error,
          });
        }
      });
    });
  }

  async reportContent(
    request: ReportContentRequest,
  ): Promise<ReportContentResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Moderation non initialisé'));
        return;
      }

      const grpcRequest = {
        content_id: request.contentId,
        reporter_id: request.reporterId,
        reason: request.reason,
        description: request.description,
      };

      this.client.ReportContent(grpcRequest, (error: any, response: any) => {
        if (error) {
          this.logger.error('Erreur lors du signalement du contenu:', error);
          resolve({
            reportId: '',
            success: false,
            error: error.message,
          });
        } else {
          resolve({
            reportId: response.report_id,
            success: response.success,
            error: response.error,
          });
        }
      });
    });
  }

  async getModerationStatus(
    request: GetModerationStatusRequest,
  ): Promise<GetModerationStatusResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Moderation non initialisé'));
        return;
      }

      this.client.GetModerationStatus(
        { content_id: request.contentId },
        (error: any, response: any) => {
          if (error) {
            this.logger.error(
              'Erreur lors de la récupération du statut de modération:',
              error,
            );
            resolve({
              contentId: request.contentId,
              status: 'error',
              reason: error.message,
              checkedAt: 0,
              error: error.message,
            });
          } else {
            resolve({
              contentId: response.content_id,
              status: response.status,
              reason: response.reason,
              checkedAt: parseInt(response.checked_at),
              moderatorId: response.moderator_id,
              error: response.error,
            });
          }
        },
      );
    });
  }

  async addBlockedHash(
    request: AddBlockedHashRequest,
  ): Promise<AddBlockedHashResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Moderation non initialisé'));
        return;
      }

      const grpcRequest = {
        hash_value: request.hashValue,
        hash_type: request.hashType,
        reason: request.reason,
        added_by: request.addedBy,
      };

      this.client.AddBlockedHash(grpcRequest, (error: any, response: any) => {
        if (error) {
          this.logger.error("Erreur lors de l'ajout du hash bloqué:", error);
          resolve({
            success: false,
            hashId: '',
            error: error.message,
          });
        } else {
          resolve({
            success: response.success,
            hashId: response.hash_id,
            error: response.error,
          });
        }
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.getModerationStatus({
        contentId: 'health-check',
      });
      return response.error !== undefined; // Si on reçoit une réponse, le service est accessible
    } catch (error) {
      this.logger.warn('Service Moderation gRPC non accessible:', error);
      return false;
    }
  }
}

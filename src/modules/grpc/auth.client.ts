import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

export interface ValidateTokenRequest {
  token: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId: string;
  error?: string;
}

export interface GetUserInfoRequest {
  userId: string;
}

export interface GetUserInfoResponse {
  userId: string;
  email: string;
  username: string;
  roles: string[];
  active: boolean;
  error?: string;
}

export interface CheckPermissionRequest {
  userId: string;
  resource: string;
  action: string;
}

export interface CheckPermissionResponse {
  allowed: boolean;
  error?: string;
}

@Injectable()
export class AuthClient implements OnModuleInit {
  private readonly logger = new Logger(AuthClient.name);
  private client: any;
  private readonly authServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.authServiceUrl = this.configService.get<string>('grpc.authService.url', 'localhost:50051');
  }

  async onModuleInit() {
    try {
      const protoPath = path.join(__dirname, '../../../proto/auth.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const authProto = grpc.loadPackageDefinition(packageDefinition).auth as any;
      
      this.client = new authProto.AuthService(
        this.authServiceUrl,
        grpc.credentials.createInsecure()
      );

      this.logger.log(`Client gRPC Auth connecté à ${this.authServiceUrl}`);
    } catch (error) {
      this.logger.error('Erreur lors de l\'initialisation du client Auth gRPC:', error);
    }
  }

  async validateToken(request: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Auth non initialisé'));
        return;
      }

      this.client.ValidateToken(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Erreur lors de la validation du token:', error);
          resolve({
            valid: false,
            userId: '',
            error: error.message,
          });
        } else {
          resolve({
            valid: response.valid,
            userId: response.user_id,
            error: response.error,
          });
        }
      });
    });
  }

  async getUserInfo(request: GetUserInfoRequest): Promise<GetUserInfoResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Auth non initialisé'));
        return;
      }

      this.client.GetUserInfo({ user_id: request.userId }, (error: any, response: any) => {
        if (error) {
          this.logger.error('Erreur lors de la récupération des infos utilisateur:', error);
          resolve({
            userId: request.userId,
            email: '',
            username: '',
            roles: [],
            active: false,
            error: error.message,
          });
        } else {
          resolve({
            userId: response.user_id,
            email: response.email,
            username: response.username,
            roles: response.roles || [],
            active: response.active,
            error: response.error,
          });
        }
      });
    });
  }

  async checkPermission(request: CheckPermissionRequest): Promise<CheckPermissionResponse> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client gRPC Auth non initialisé'));
        return;
      }

      const grpcRequest = {
        user_id: request.userId,
        resource: request.resource,
        action: request.action,
      };

      this.client.CheckPermission(grpcRequest, (error: any, response: any) => {
        if (error) {
          this.logger.error('Erreur lors de la vérification des permissions:', error);
          resolve({
            allowed: false,
            error: error.message,
          });
        } else {
          resolve({
            allowed: response.allowed,
            error: response.error,
          });
        }
      });
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.validateToken({ token: 'health-check' });
      return response.error !== undefined; // Si on reçoit une réponse, le service est accessible
    } catch (error) {
      this.logger.warn('Service Auth gRPC non accessible:', error);
      return false;
    }
  }
}
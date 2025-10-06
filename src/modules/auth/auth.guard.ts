import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthClient } from '../grpc/auth.client';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly authClient: AuthClient,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Token d'authentification manquant");
    }

    try {
      const validation = await this.authClient.validateToken({ token });

      if (!validation.valid) {
        throw new UnauthorizedException(
          validation.error || "Token d'authentification invalide",
        );
      }

      // Récupérer les informations utilisateur
      const userInfo = await this.authClient.getUserInfo({
        userId: validation.userId,
      });

      if (userInfo.error || !userInfo.active) {
        throw new UnauthorizedException('Utilisateur inactif ou introuvable');
      }

      // Ajouter les informations utilisateur à la requête
      request.user = {
        id: userInfo.userId,
        email: userInfo.email,
        username: userInfo.username,
        roles: userInfo.roles,
      };

      return true;
    } catch (error) {
      this.logger.error('Erreur lors de la validation du token:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Erreur d'authentification");
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

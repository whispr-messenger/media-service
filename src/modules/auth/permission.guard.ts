import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthClient } from '../grpc/auth.client';

export const PERMISSIONS_KEY = 'permissions';

export interface Permission {
  resource: string;
  action: string;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly authClient: AuthClient,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    try {
      // Vérifier chaque permission requise
      for (const permission of requiredPermissions) {
        const permissionCheck = await this.authClient.checkPermission({
          userId: user.id,
          resource: permission.resource,
          action: permission.action,
        });

        if (permissionCheck.error) {
          this.logger.error(
            `Erreur lors de la vérification de permission: ${permissionCheck.error}`,
          );
          throw new ForbiddenException(
            'Erreur de vérification des permissions',
          );
        }

        if (!permissionCheck.allowed) {
          throw new ForbiddenException(
            `Permission refusée: ${permission.action} sur ${permission.resource}`,
          );
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification des permissions:',
        error,
      );

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Erreur de vérification des permissions');
    }
  }
}

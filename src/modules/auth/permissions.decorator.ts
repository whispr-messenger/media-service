import { SetMetadata } from '@nestjs/common';
import { Permission, PERMISSIONS_KEY } from './permission.guard';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Permissions prédéfinies pour les médias
export const MediaPermissions = {
  UPLOAD: { resource: 'media', action: 'upload' },
  DOWNLOAD: { resource: 'media', action: 'download' },
  DELETE: { resource: 'media', action: 'delete' },
  VIEW_ALL: { resource: 'media', action: 'view_all' },
  MODERATE: { resource: 'media', action: 'moderate' },
  ADMIN: { resource: 'media', action: 'admin' },
} as const;

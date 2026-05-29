import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from '../domain/models';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: AdminPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
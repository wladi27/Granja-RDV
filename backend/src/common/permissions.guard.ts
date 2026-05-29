import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { AuthenticatedUser } from './auth.types';
import { DomainService } from './domain.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly domainService: DomainService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || user.role !== 'admin') {
      return false;
    }

    const effectivePermissions = await this.resolvePermissions(user);

    if (effectivePermissions.includes('*')) {
      return true;
    }

    return requiredPermissions.every((permission) => effectivePermissions.includes(permission as AuthenticatedUser['permissions'][number]));
  }

  private async resolvePermissions(user: AuthenticatedUser): Promise<AuthenticatedUser['permissions']> {
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions;
    }

    const dbUser = await this.domainService.getUserAuthById(user.sub);
    const permissions = this.domainService['normalizePermissions'](dbUser.permissions) as AuthenticatedUser['permissions'];

    if (permissions.length > 0) {
      return permissions;
    }

    return user.role === 'admin' ? ['*'] : [];
  }
}
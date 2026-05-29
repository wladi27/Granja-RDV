import { AdminPermission, UserRole } from '../domain/models';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: AdminPermission[];
}

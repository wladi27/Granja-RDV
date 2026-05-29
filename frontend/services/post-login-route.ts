import { StoredAuthSession } from '@/services/auth-session';

function isSafeRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
}

export function getPostLoginRoute(session: Pick<StoredAuthSession, 'user'>, nextPath?: string | null): string {
  if (nextPath && isSafeRelativePath(nextPath)) {
    return nextPath;
  }

  if (session.user.role === 'admin') {
    return '/admin';
  }

  if (session.user.role === 'courier') {
    return '/courier';
  }

  return `/dashboard/${session.user.id}`;
}

import { AdminPermission, UserRole } from '@/types/domain';

export interface StoredAuthUser {
  id: string;
  username: string | null;
  email: string;
  fullName: string;
  whatsappPhone?: string | null;
  role: UserRole;
  permissions?: AdminPermission[];
  referralCode?: string;
}

export interface StoredAuthSession {
  user: StoredAuthUser;
  accessToken: string;
  refreshToken: string;
}

const SESSION_KEY = 'grv_auth_session';
export const AUTH_SESSION_CHANGED_EVENT = 'grv-auth-session-changed';

export function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function emitAuthSessionChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function getAuthSession(): StoredAuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredAuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: StoredAuthSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emitAuthSessionChanged();
}

export function clearAuthSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
  emitAuthSessionChanged();
}

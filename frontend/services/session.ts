import { AUTH_SESSION_CHANGED_EVENT } from '@/services/auth-session';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawSession = window.localStorage.getItem('grv_auth_session');
  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as { accessToken?: string };
    return session.accessToken ?? null;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  const rawSession = window.localStorage.getItem('grv_auth_session');
  const currentSession = rawSession ? (JSON.parse(rawSession) as Record<string, unknown>) : {};
  window.localStorage.setItem(
    'grv_auth_session',
    JSON.stringify({
      ...currentSession,
      accessToken: token,
    }),
  );
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function clearAccessToken(): void {
  window.localStorage.removeItem('grv_auth_session');
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

import { AdminPermission, UserRole } from '@/types/domain';
import { normalizeError, parseBackendErrorMessage, toFriendlyErrorMessage } from '@/services/error-utils';
import { resolveApiBaseUrl } from '@/services/api-base-url';

const API_BASE_URL = resolveApiBaseUrl();

export interface AuthUser {
  id: string;
  username: string | null;
  email: string;
  fullName: string;
  whatsappPhone?: string | null;
  role: UserRole;
  permissions: AdminPermission[];
  referralCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    const parsed = parseBackendErrorMessage(text);
    throw new Error(toFriendlyErrorMessage(parsed, 'No fue posible iniciar sesión.'));
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    return handleResponse<AuthResponse>(response);
  } catch (error) {
    throw new Error(normalizeError(error, 'No fue posible iniciar sesión.'));
  }
}

import { normalizeError, parseBackendErrorMessage, toFriendlyErrorMessage } from '@/services/error-utils';
import { AdminPermission } from '@/types/domain';
import { resolveApiBaseUrl } from '@/services/api-base-url';

const API_BASE_URL = resolveApiBaseUrl();

export interface RegisterResponse {
  user: {
    id: string;
    username: string | null;
    email: string;
    fullName: string;
    whatsappPhone?: string | null;
    role: 'admin' | 'customer' | 'courier';
    permissions: AdminPermission[];
    referralCode?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    const parsed = parseBackendErrorMessage(text);
    throw new Error(toFriendlyErrorMessage(parsed, 'No fue posible crear la cuenta.'));
  }

  return (await response.json()) as T;
}

export async function register(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  sponsorCode?: string;
}): Promise<RegisterResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    return handleResponse<RegisterResponse>(response);
  } catch (error) {
    throw new Error(normalizeError(error, 'No fue posible crear la cuenta.'));
  }
}

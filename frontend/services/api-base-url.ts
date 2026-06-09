const DEFAULT_API_BASE_URL = 'http://localhost:3002/api';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveApiBaseUrl(): string {
  const configuredValue = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredValue) {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
      const normalized = configuredValue.toLowerCase();
      if (normalized.includes('localhost') || normalized.includes('devtunnels.ms')) {
        return `${window.location.origin}/backend/api`;
      }
    }

    return trimTrailingSlash(configuredValue);
  }

  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return `${window.location.origin}/backend/api`;
  }

  return DEFAULT_API_BASE_URL;
}

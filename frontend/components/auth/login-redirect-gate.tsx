'use client';

import { useEffect } from 'react';
import { getAuthSession } from '@/services/auth-session';
import { getPostLoginRoute } from '@/services/post-login-route';

export function LoginRedirectGate() {
  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      return;
    }

    const url = new URL(window.location.href);
    const nextPath = url.searchParams.get('next');
    const target = getPostLoginRoute(session, nextPath);

    if (window.location.pathname + window.location.search !== target) {
      window.location.replace(target);
    }
  }, []);

  return null;
}

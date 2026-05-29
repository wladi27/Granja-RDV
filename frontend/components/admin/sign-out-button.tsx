'use client';

import { useRouter } from 'next/navigation';
import { clearAuthSession } from '@/services/auth-session';

export function SignOutButton() {
  const router = useRouter();

  function handleSignOut() {
    clearAuthSession();
    router.replace('/login');
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
    >
      Cerrar sesión
    </button>
  );
}
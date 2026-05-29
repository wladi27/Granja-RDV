'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AUTH_SESSION_CHANGED_EVENT,
  getAuthSession,
  StoredAuthSession,
} from '@/services/auth-session';

export function SiteHeader() {
  const pathname = usePathname();
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSession(getAuthSession());

    const handleStorage = () => setSession(getAuthSession());
    const handleAuthSessionChanged = () => setSession(getAuthSession());

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleStorage);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleStorage);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    };
  }, []);

  if (pathname === '/' || (mounted && session)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/82 backdrop-blur-xl" suppressHydrationWarning>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 md:px-6" suppressHydrationWarning>
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] text-sm font-bold text-white shadow-md shadow-sky-900/20">
            GR
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-semibold text-[var(--ink)]">Granja Raiz de Vida</span>
            <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Mobile Commerce</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
          <Link className="rounded-full px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]" href="/login">
            Login
          </Link>
          <Link
            className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-3 py-1.5 text-white shadow-md shadow-sky-900/20 transition hover:translate-y-[-1px]"
            href="/register"
          >
            Registro
          </Link>
        </nav>
      </div>
    </header>
  );
}

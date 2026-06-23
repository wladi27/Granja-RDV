'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { canAccessAdminModule } from '@/services/admin-permissions';
import { AUTH_SESSION_CHANGED_EVENT, clearAuthSession, getAuthSession, StoredAuthSession } from '@/services/auth-session';

type NavItem = {
  href?: string;
  label: string;
  icon: 'home' | 'wallet' | 'shop' | 'network' | 'profile' | 'admin' | 'users' | 'courier' | 'orders' | 'inventory' | 'settings';
  match?: string;
  exact?: boolean;
};

function renderIcon(icon: NavItem['icon'], active: boolean) {
  const stroke = active ? 'currentColor' : 'currentColor';
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (icon) {
    case 'home':
      return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M9 20v-6h6v6" /></svg>;
    case 'wallet':
      return <svg {...common}><path d="M4.5 7.5h14A1.5 1.5 0 0 1 20 9v7a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 15.5v-6A2 2 0 0 1 6 7.5Z" /><path d="M16 12h4" /><path d="M4.5 7.5 7 4h10.5" /></svg>;
    case 'shop':
      return <svg {...common}><path d="M5 9h14l-1 12H6L5 9Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /><path d="M9 13h.01" /><path d="M15 13h.01" /></svg>;
    case 'network':
      return <svg {...common}><circle cx="7" cy="7" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="12" cy="17" r="2" /><path d="M9 7h6" /><path d="M8.3 8.7 11 15" /><path d="M15.7 8.7 13 15" /></svg>;
    case 'profile':
      return <svg {...common}><circle cx="12" cy="8" r="3.25" /><path d="M5.5 19.5c1.6-3.5 5-5.5 6.5-5.5s4.9 2 6.5 5.5" /></svg>;
    case 'admin':
      return <svg {...common}><path d="M12 3 4 7v6c0 4.5 3.2 7.9 8 10 4.8-2.1 8-5.5 8-10V7l-8-4Z" /><path d="M9 12.5 11 14.5 15 10.5" /></svg>;
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c1.2-3 3.5-4.5 5.5-4.5s4.3 1.5 5.5 4.5" /><path d="M16 11c1.7 0 3.1 1 4 3" /></svg>;
    case 'courier':
      return <svg {...common}><path d="M3.5 15.5h11l3.5-5H8L6.8 6.5H3.5" /><circle cx="8.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></svg>;
    case 'orders':
      return <svg {...common}><path d="M6 4h12" /><path d="M6 10h12" /><path d="M6 16h12" /><path d="M6 22h12" /></svg>;
    case 'inventory':
      return <svg {...common}><path d="M4 8 12 4l8 4-8 4-8-4Z" /><path d="M4 12l8 4 8-4" /><path d="M4 16l8 4 8-4" /></svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h0a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg>;
    default:
      return null;
  }
}

interface AppBottomNavProps {
  userId?: string;
  role?: 'admin' | 'courier' | 'customer';
}

function getNavItems(userId?: string, role?: 'admin' | 'courier' | 'customer'): NavItem[] {
  const dashboardHref = userId ? `/dashboard/${userId}` : '/dashboard';
  const walletHref = userId ? `/dashboard/${userId}/wallet` : '/dashboard';
  const networkHref = userId ? `/dashboard/${userId}/network` : '/dashboard';
  const profileHref = userId ? `/dashboard/${userId}/profile` : '/dashboard';
  const storeHref = userId ? `/dashboard/${userId}/store` : '/store';

  if (role === 'customer') {
    return [
      { href: dashboardHref, label: 'Inicio', icon: 'home', match: dashboardHref, exact: true },
      { href: walletHref, label: 'Wallet', icon: 'wallet', match: walletHref },
      { href: networkHref, label: 'Red', icon: 'network', match: networkHref },
      { href: storeHref, label: 'Tienda', icon: 'shop', match: storeHref },
      { href: profileHref, label: 'Perfil', icon: 'profile', match: profileHref },
    ];
  }

  if (role === 'admin') {
    return [
      { href: '/admin', label: 'Inicio', icon: 'admin', match: '/admin', exact: true },
      { href: '/admin/orders', label: 'Pedidos', icon: 'orders', match: '/admin/orders' },
      { href: '/admin/inventory', label: 'Inventario', icon: 'inventory', match: '/admin/inventory' },
      { href: '/admin/withdrawals', label: 'Retiros', icon: 'wallet', match: '/admin/withdrawals' },
      { href: '/admin/config', label: 'Config', icon: 'settings', match: '/admin/config' },
    ];
  }

  if (role === 'courier') {
    return [
      { href: '/courier', label: 'Ruta', icon: 'courier', match: '/courier', exact: true },
      { href: '/courier/orders', label: 'Asignadas', icon: 'orders', match: '/courier/orders' },
      { href: '/courier/delivered', label: 'Entregadas', icon: 'orders', match: '/courier/delivered' },
      { href: '/courier/profile', label: 'Perfil', icon: 'profile', match: '/courier/profile' },
    ];
  }

  return [
    { href: dashboardHref, label: 'Inicio', icon: 'home', match: '/dashboard/' },
    { href: '/register', label: 'Red', icon: 'network', match: '/register' },
    { href: '/login', label: 'Cuenta', icon: 'profile', match: '/login' },
  ];
}

export function AppBottomNav({ userId, role }: AppBottomNavProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const handleSessionChange = () => {
      setSession(getAuthSession());
    };

    setSession(getAuthSession());
    setHydrated(true);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChange);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleSessionChange);
    };
  }, []);

  const items = useMemo(() => getNavItems(userId, role), [role, userId]);
  const visibleItems = useMemo(() => {
    if (role !== 'admin') {
      return items;
    }

    if (!hydrated) {
      return items;
    }

    return items.filter((item) => {
      if (item.href === '/admin') {
        return canAccessAdminModule(session?.user.permissions, 'home');
      }
      if (item.href === '/admin/orders') {
        return canAccessAdminModule(session?.user.permissions, 'orders');
      }
      if (item.href === '/admin/inventory') {
        return canAccessAdminModule(session?.user.permissions, 'inventory');
      }
      if (item.href === '/admin/withdrawals') {
        return canAccessAdminModule(session?.user.permissions, 'withdrawals');
      }
      if (item.href === '/admin/config') {
        return canAccessAdminModule(session?.user.permissions, 'config');
      }

      return true;
    });
  }, [hydrated, items, role, session?.user.permissions]);

  const showInPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/courier') ||
    pathname.startsWith('/store');

  if (!showInPath) {
    return null;
  }

  function isItemActive(item: NavItem): boolean {
    if (!item.match) {
      return pathname === item.href;
    }

    if (item.exact) {
      return pathname === item.match;
    }

    return pathname === item.match || pathname.startsWith(`${item.match}/`);
  }

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-4" suppressHydrationWarning>
      <div
        className="mx-auto grid max-w-2xl gap-2 rounded-[1.6rem] border border-[var(--line)] bg-white/95 p-2 shadow-[0_18px_50px_rgba(16,42,54,0.18)] backdrop-blur-xl"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length + (role === 'courier' ? 1 : 0)}, minmax(0, 1fr))` }}
        suppressHydrationWarning
      >
        {visibleItems.map((item) => {
          const isActive = isItemActive(item);

          const content = (
            <>
              <span className={`grid h-8 w-8 place-items-center rounded-full transition ${isActive ? 'bg-[#102a43] text-white' : 'bg-[var(--surface-50)] text-[var(--ink)]'}`}>
                {renderIcon(item.icon, isActive)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{item.label}</span>
            </>
          );

          const baseClassName = `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center transition ${
            isActive
              ? 'bg-[linear-gradient(135deg,rgba(31,95,150,0.14),rgba(41,179,148,0.12))] text-[var(--ink)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface-50)]'
          }`;

          return item.href ? (
            <Link key={item.href} href={item.href} className={baseClassName}>
              {content}
            </Link>
          ) : null;
        })}

        {role === 'courier' ? (
          <button
            key="signout"
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                clearAuthSession();
                window.location.replace('/login');
              }
            }}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center transition text-[var(--muted)] hover:bg-[var(--surface-50)]`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-50)] text-[var(--ink)]`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Salir</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}
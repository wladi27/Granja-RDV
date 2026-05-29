'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canAccessAdminModule } from '@/services/admin-permissions';
import { AUTH_SESSION_CHANGED_EVENT, getAuthSession, StoredAuthSession } from '@/services/auth-session';

const adminMenuItems = [
  { href: '/admin', label: 'Resumen', module: 'home' as const },
  { href: '/admin/orders', label: 'Órdenes', module: 'orders' as const },
  { href: '/admin/inventory', label: 'Productos', module: 'inventory' as const },
  { href: '/admin/withdrawals', label: 'Retiros', module: 'withdrawals' as const },
  { href: '/admin/config', label: 'Configuración', module: 'config' as const },
];

const configSubmenuItems = [
  { href: '/admin/config', label: 'Sistema' },
  { href: '/admin/config/payment-methods', label: 'Pagos' },
  { href: '/admin/config/delivery-fees', label: 'Domicilios' },
  { href: '/admin/config/admins', label: 'Admins' },
  { href: '/admin/config/couriers', label: 'Repartidores' },
  { href: '/admin/config/network', label: 'Red' },
];

export function AdminMenu() {
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

  const visibleMenuItems = hydrated
    ? adminMenuItems.filter((item) => canAccessAdminModule(session?.user.permissions, item.module))
    : adminMenuItems;
  const isConfigSection = pathname.startsWith('/admin/config');

  return (
    <div className="mt-4 space-y-2" suppressHydrationWarning>
      <nav className="app-card overflow-x-auto border-[#bfd2e4] bg-[#f5f9fd] p-2" suppressHydrationWarning>
        <div className="flex min-w-max items-center gap-2" suppressHydrationWarning>
          {visibleMenuItems.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.11em] transition ${
                  isActive
                    ? 'bg-[#0f2f48] !text-white shadow-[0_8px_20px_rgba(15,47,72,0.28)]'
                    : 'border border-[#b9ccdd] bg-white text-[#14364d] hover:border-[#1f5f96] hover:bg-[#eef5fb] hover:text-[#103f64]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {isConfigSection ? (
        <nav className="app-card overflow-x-auto border-[#bfd2e4] bg-[#f5f9fd] p-2" suppressHydrationWarning>
          <div className="flex min-w-max items-center gap-2" suppressHydrationWarning>
            {configSubmenuItems.map((item) => {
              const isActive = item.href === '/admin/config'
                ? pathname === '/admin/config'
                : pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] transition ${
                    isActive
                      ? 'bg-[#123853] !text-white shadow-[0_5px_14px_rgba(18,56,83,0.22)]'
                      : 'border border-[#c3d3e2] bg-white text-[#2f5168] hover:border-[#1f5f96] hover:bg-[#eef5fb] hover:text-[#103f64]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

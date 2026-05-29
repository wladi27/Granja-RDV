import { AdminMenu } from '@/components/admin/admin-menu';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { SystemConfigPanel } from '@/components/admin/system-config-panel';
import Link from 'next/link';

export default function AdminConfigPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Panel admin</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Configuración</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Secciones separadas para admins, repartidores y red.</p>
          </div>
          <SignOutButton />
        </div>
      </section>

      <AdminMenu />

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/config/payment-methods" className="app-card p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,42,67,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Pagos</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Metodos de pago</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Crear, editar y eliminar cuentas de cobro por metodo.</p>
        </Link>

        <Link href="/admin/config/delivery-fees" className="app-card p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,42,67,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Domicilios</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Tarifas por municipio</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Define el valor de envío para Dosquebradas, Pereira y Cuba.</p>
        </Link>

        <Link href="/admin/config/admins" className="app-card p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,42,67,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Usuarios</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Admins</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Crear, editar y paginar usuarios administradores.</p>
        </Link>

        <Link href="/admin/config/couriers" className="app-card p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,42,67,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Operación</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Repartidores</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Crear y administrar repartidores con WhatsApp y credenciales.</p>
        </Link>

        <Link href="/admin/config/network" className="app-card p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,42,67,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Referidos</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Red</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Consulta por codigo y visualiza niveles de red.</p>
        </Link>
      </section>

      <section className="mt-4">
        <SystemConfigPanel />
      </section>

      <AppBottomNav role="admin" />
    </main>
  );
}

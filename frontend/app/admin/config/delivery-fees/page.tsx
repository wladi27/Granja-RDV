import { AdminMenu } from '@/components/admin/admin-menu';
import DeliveryFeesPanel from '@/components/admin/delivery-fees-panel';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function AdminConfigDeliveryFeesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <section className="app-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Panel admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Tarifas de domicilio</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Vista separada para configurar valores de envio por municipio.</p>
      </section>

      <AdminMenu />

      <section className="mt-4">
        <DeliveryFeesPanel />
      </section>

      <AppBottomNav role="admin" />
    </main>
  );
}

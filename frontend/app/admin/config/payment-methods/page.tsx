import { AdminMenu } from '@/components/admin/admin-menu';
import PaymentMethodsPanel from '@/components/admin/payment-methods-panel';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function AdminConfigPaymentMethodsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <section className="app-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Panel admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Configuracion de metodos de pago</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Vista dedicada para crear, editar, eliminar y guardar cuentas de cobro.</p>
      </section>

      <AdminMenu />

      <section className="mt-4">
        <PaymentMethodsPanel />
      </section>

      <AppBottomNav role="admin" />
    </main>
  );
}

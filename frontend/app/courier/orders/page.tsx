import { CourierDashboard } from '@/components/courier/courier-dashboard';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function CourierOrdersPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <section className="app-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Panel repartidor</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Pedidos asignados</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Aquí armas tu ruta. Cuando agregas un pedido, el sistema lo mueve a Mi ruta, guarda el orden y lo marca en camino.
        </p>
      </section>

      <section className="mt-4">
        <CourierDashboard />
      </section>

      <AppBottomNav role="courier" />
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { addOrderToCourierRoute, getCourierOrders } from '@/services/api';
import { CourierOrderRow, CourierOrdersPage } from '@/types/domain';

const COURIER_PAGE_SIZE = 6;

const STATUS_LABELS: Record<CourierOrderRow['status'], string> = {
  pending_payment: 'Pendiente de pago',
  paid: 'Pagada',
  confirmed: 'Confirmada',
  assigned: 'Asignada al repartidor',
  picked_up: 'Recogida',
  on_the_way: 'En camino',
  delivered: 'Entregada',
};

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusTone(status: CourierOrderRow['status']): string {
  switch (status) {
    case 'picked_up':
    case 'assigned':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'on_the_way':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-[var(--line)] bg-[var(--surface-50)] text-[var(--muted)]';
  }
}

export function CourierDashboard() {
  const [ordersPage, setOrdersPage] = useState<CourierOrdersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function loadData(targetPage = page) {
    const nextPage = await getCourierOrders(targetPage, COURIER_PAGE_SIZE);
    setOrdersPage(nextPage);
  }

  useEffect(() => {
    let mounted = true;

    loadData(page)
      .then(() => {
        if (mounted) {
          setLoading(false);
        }
      })
      .catch((requestError: Error) => {
        if (mounted) {
          setError(requestError.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [page]);

  async function handleAddToRoute(orderId: string) {
    setMessage(null);
    try {
      await addOrderToCourierRoute(orderId);
      await loadData(page);
      setMessage('Pedido agregado a la ruta. Su estado pasó a En camino y quedó guardado.');
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'No fue posible agregar el pedido a la ruta.');
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Cargando pedidos asignados...</p>;
  }

  if (error) {
    return <div className="app-card border-red-200 bg-red-50 p-4 text-red-700">Error cargando pedidos: {error}</div>;
  }

  const orders = ordersPage?.orders ?? [];
  const total = ordersPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (ordersPage?.pageSize ?? COURIER_PAGE_SIZE)));

  return (
    <section className="space-y-4">
      {message ? <p className="rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

      {orders.length === 0 ? (
        <div className="app-card p-5 text-sm text-[var(--muted)]">No tienes pedidos pendientes por agregar a la ruta.</div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="app-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-[var(--ink)]">{order.customer_name}</p>
                  <p className="text-xs text-[var(--muted)]">Pedido #{order.id.slice(0, 8)}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getStatusTone(order.status)}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Dirección</p>
                  <p className="mt-1 text-xs text-[var(--ink)]">{order.address ?? 'Sin dirección'}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Contacto</p>
                  <p className="mt-1 text-xs text-[var(--ink)]">{order.phone ?? 'Sin teléfono'}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Total</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--accent)]">{formatCop(order.total_cop)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAddToRoute(order.id)}
                  className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold text-white"
                >
                  Añadir a ruta y marcar En camino
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-xs font-semibold text-[var(--muted)]">Página {page} de {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
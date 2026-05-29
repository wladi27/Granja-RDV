'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getCourierDeliveredOrders } from '@/services/api';
import { CourierDeliveredOrdersFilters, CourierOrdersPage } from '@/types/domain';

const PAGE_SIZE = 8;

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const EMPTY_FILTERS: CourierDeliveredOrdersFilters = {
  customerName: '',
  phone: '',
  orderId: '',
  fromDate: '',
  toDate: '',
  q: '',
};

export function CourierDeliveredOrdersPanel() {
  const [filters, setFilters] = useState<CourierDeliveredOrdersFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<CourierDeliveredOrdersFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState<CourierOrdersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(targetPage = page, targetFilters = appliedFilters) {
    const data = await getCourierDeliveredOrders({
      ...targetFilters,
      page: targetPage,
      pageSize: PAGE_SIZE,
    });
    setOrdersPage(data);
  }

  useEffect(() => {
    let mounted = true;

    loadData(page, appliedFilters)
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
  }, [page, appliedFilters]);

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Cargando pedidos entregados...</p>;
  }

  if (error) {
    return <div className="app-card border-red-200 bg-red-50 p-4 text-red-700">Error cargando entregados: {error}</div>;
  }

  const orders = ordersPage?.orders ?? [];
  const total = ordersPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (ordersPage?.pageSize ?? PAGE_SIZE)));

  return (
    <section className="space-y-4">
      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Histórico</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Pedidos entregados</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Consulta entregas finalizadas con paginación y filtros avanzados.</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Resultados</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{total}</p>
          </div>
        </div>

        <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleApplyFilters}>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nombre del cliente</label>
            <input
              type="text"
              className="app-input"
              placeholder="Ej: Juan Pérez"
              value={filters.customerName ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, customerName: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Teléfono</label>
            <input
              type="text"
              className="app-input"
              placeholder="Ej: 3001234567"
              value={filters.phone ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Pedido</label>
            <input
              type="text"
              className="app-input"
              placeholder="ID parcial"
              value={filters.orderId ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, orderId: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Desde fecha</label>
            <input
              type="date"
              className="app-input"
              value={filters.fromDate ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Hasta fecha</label>
            <input
              type="date"
              className="app-input"
              value={filters.toDate ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Búsqueda general</label>
            <input
              type="text"
              className="app-input"
              placeholder="Nombre, teléfono, dirección o ID"
              value={filters.q ?? ''}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
          >
            Limpiar
          </button>
        </form>
      </section>

      {orders.length === 0 ? (
        <div className="app-card p-5 text-sm text-[var(--muted)]">No se encontraron pedidos entregados con los filtros actuales.</div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="app-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-[var(--ink)]">{order.customer_name}</p>
                  <p className="text-xs text-[var(--muted)]">Pedido #{order.id.slice(0, 8)}</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  Entregado
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Entregado</p>
                  <p className="mt-1 text-xs text-[var(--ink)]">{formatDateTime(order.delivered_at)}</p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Confirmado cliente</p>
                  <p className="mt-1 text-xs text-[var(--ink)]">{formatDateTime(order.customer_received_confirmed_at)}</p>
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

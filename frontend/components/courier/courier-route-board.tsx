'use client';

import { useEffect, useState } from 'react';
import { getCourierRoute, getDeliveryQr, reorderCourierRoute } from '@/services/api';
import { CourierOrderRow, DeliveryQrPayload } from '@/types/domain';
import { DeliveryQrModal } from '@/components/courier/delivery-qr-modal';

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function CourierRouteBoard() {
  const [orders, setOrders] = useState<CourierOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeQr, setActiveQr] = useState<(DeliveryQrPayload & { qrImageUrl: string; confirmationUrl: string }) | null>(null);

  async function loadRoute() {
    const nextOrders = await getCourierRoute();
    setOrders(nextOrders);
  }

  useEffect(() => {
    let mounted = true;

    loadRoute()
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
  }, []);

  async function handleMove(orderId: string, direction: -1 | 1) {
    const index = orders.findIndex((order) => order.id === orderId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= orders.length) {
      return;
    }

    const nextOrders = moveItem(orders, index, nextIndex);
    setOrders(nextOrders);
    setMessage(null);
    try {
      const persisted = await reorderCourierRoute(nextOrders.map((order) => order.id));
      setOrders(persisted);
      setMessage('Ruta actualizada y guardada correctamente.');
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'No fue posible reordenar la ruta.');
      await loadRoute();
    }
  }

  async function handleGenerateQr(orderId: string) {
    setMessage(null);
    try {
      const payload = await getDeliveryQr(orderId);
      const origin = typeof window === 'undefined' ? '' : window.location.origin;
      const confirmationUrl = `${origin}/delivery/confirm?token=${encodeURIComponent(payload.token)}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(confirmationUrl)}`;
      setActiveQr({
        ...payload,
        confirmationUrl,
        qrImageUrl,
      });
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'No fue posible generar el QR de entrega.');
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Cargando ruta del repartidor...</p>;
  }

  if (error) {
    return <div className="app-card border-red-200 bg-red-50 p-4 text-red-700">Error cargando ruta: {error}</div>;
  }

  return (
    <section className="space-y-4">
      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Mi ruta</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Paradas activas del repartidor</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">El orden se guarda en el servidor. Si cierras sesión o cambias de dispositivo, la ruta sigue igual.</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Paradas</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{orders.length}</p>
          </div>
        </div>
      </section>

      {message ? <p className="rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

      {orders.length === 0 ? (
        <div className="app-card p-5 text-sm text-[var(--muted)]">No hay pedidos en tu ruta activa. Ve a Pedidos asignados y agrega las entregas que vas a despachar.</div>
      ) : (
        <ol className="space-y-3">
          {orders.map((order, index) => (
            <li key={order.id} className="app-card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-[var(--ink)]">{order.customer_name}</p>
                      <p className="text-xs text-[var(--muted)]">Pedido #{order.id.slice(0, 8)} · Estado actual: En camino</p>
                    </div>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                      En camino
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
                      onClick={() => handleMove(order.id, -1)}
                      disabled={index === 0}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-40"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(order.id, 1)}
                      disabled={index === orders.length - 1}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-40"
                    >
                      Bajar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateQr(order.id)}
                      className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold text-white"
                    >
                      Generar QR y enlace de entrega
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <DeliveryQrModal activeQr={activeQr} onClose={() => setActiveQr(null)} />
    </section>
  );
}
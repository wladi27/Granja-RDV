'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuthSession } from '@/services/auth-session';
import { confirmDeliveryByToken, getDeliveryConfirmationPreview } from '@/services/api';
import { DeliveryConfirmationPreview } from '@/types/domain';

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatus(status: DeliveryConfirmationPreview['status']): string {
  const labels: Record<DeliveryConfirmationPreview['status'], string> = {
    pending_payment: 'Pendiente de pago',
    paid: 'Pagada',
    confirmed: 'Confirmada',
    assigned: 'Asignada',
    picked_up: 'Recogida',
    on_the_way: 'En camino',
    delivered: 'Entregada',
  };

  return labels[status] ?? status.replaceAll('_', ' ');
}

function DeliveryConfirmationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [preview, setPreview] = useState<DeliveryConfirmationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!token) {
      setError('El enlace de confirmación no es válido.');
      setLoading(false);
      return;
    }

    const session = getAuthSession();
    if (!session) {
      const next = encodeURIComponent(`/delivery/confirm?token=${encodeURIComponent(token)}`);
      window.location.replace(`/login?next=${next}`);
      return;
    }

    getDeliveryConfirmationPreview(token)
      .then((data) => {
        if (mounted) {
          setPreview(data);
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
  }, [token]);

  async function handleConfirm() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await confirmDeliveryByToken(token);
      const latest = await getDeliveryConfirmationPreview(token);
      setPreview(latest);
      setMessage('Entrega confirmada correctamente.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible confirmar la entrega.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6">
      <section className="app-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,#17372a,#2b8a6d)] px-5 py-6 text-white sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Confirmación de entrega</p>
          <h1 className="mt-2 text-2xl font-semibold">Validar recepción del pedido</h1>
          <p className="mt-2 text-sm text-white/80">Este paso solo puede completarlo el cliente dueño del pedido con su sesión iniciada.</p>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? <p className="text-sm text-[var(--muted)]">Cargando información de la entrega...</p> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

          {preview ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Cliente</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{preview.customerName}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Código</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{preview.deliveryCode}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Dirección</p>
                  <p className="mt-1 text-sm text-[var(--ink)]">{preview.address ?? 'Sin dirección registrada'}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Total</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(preview.totalCop)}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Estado</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatStatus(preview.status)}</p>
                </div>
              </div>

              {preview.customerReceivedConfirmedAt ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Esta entrega ya fue confirmada anteriormente.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || preview.status !== 'on_the_way'}
                  className="w-full rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Confirmando...' : 'Confirmar recepción del pedido'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function DeliveryConfirmationPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6"><p className="text-sm text-[var(--muted)]">Cargando confirmación...</p></main>}>
      <DeliveryConfirmationContent />
    </Suspense>
  );
}
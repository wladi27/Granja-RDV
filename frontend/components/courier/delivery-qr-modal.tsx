'use client';

import { useState } from 'react';
import { DeliveryQrPayload } from '@/types/domain';

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null): string {
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

interface DeliveryQrModalProps {
  activeQr: (DeliveryQrPayload & { qrImageUrl: string; confirmationUrl: string }) | null;
  onClose: () => void;
}

export function DeliveryQrModal({ activeQr, onClose }: DeliveryQrModalProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  if (!activeQr) {
    return null;
  }

  async function handleCopyConfirmationLink() {
    try {
      await navigator.clipboard.writeText(activeQr.confirmationUrl);
      setCopyMessage('Enlace copiado al portapapeles.');
    } catch {
      setCopyMessage('No fue posible copiar automáticamente. Usa el enlace visible para copiarlo manualmente.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] bg-[linear-gradient(135deg,#f8fbff,#eef6fb)] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Confirmación de entrega</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--ink)] sm:text-xl">QR para validar con el cliente</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">Muestra este código o comparte el enlace directo si el cliente no puede escanear.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
            >
              Cerrar
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
              <div className="rounded-3xl border border-[var(--line)] bg-[linear-gradient(180deg,#f9fcff_0%,#eff6fb_100%)] p-4">
                <div className="rounded-[24px] border border-white/80 bg-white p-3 shadow-sm">
                  <img src={activeQr.qrImageUrl} alt="QR de confirmación de entrega" className="mx-auto h-full w-full max-w-[280px] rounded-2xl bg-white object-contain" />
                </div>
                <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Código de entrega</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[0.18em] text-[var(--ink)]">{activeQr.deliveryCode}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Cliente</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{activeQr.order.customerName}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Vencimiento</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatDateTime(activeQr.expiresAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Dirección</p>
                    <p className="mt-1 text-sm text-[var(--ink)]">{activeQr.order.address ?? 'Sin dirección registrada'}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-3 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Valor del pedido</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCop(activeQr.order.totalCop)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Enlace alterno</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Si el cliente no puede escanear, puede abrir este enlace, iniciar sesión con su cuenta y confirmar la recepción.</p>
                  <p className="mt-3 max-h-32 overflow-y-auto break-all rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink)]">
                    {activeQr.confirmationUrl}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyConfirmationLink}
                    className="mt-3 w-full rounded-full border border-[#1f5f96] bg-white px-4 py-2.5 text-xs font-semibold text-[#1f5f96]"
                  >
                    Copiar enlace al portapapeles
                  </button>
                  {copyMessage ? <p className="mt-2 text-xs text-[var(--muted)]">{copyMessage}</p> : null}
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                  El cliente debe confirmar con su propia sesión. Si abre el enlace sin login, será enviado a la pantalla de acceso y luego volverá automáticamente a esta validación.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
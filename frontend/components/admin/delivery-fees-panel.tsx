'use client';

import { useEffect, useState } from 'react';
import { getSystemConfig, updateSystemConfig } from '@/services/api';
import { DeliveryFeesByMunicipality, SystemConfig } from '@/types/domain';

const MUNICIPALITIES: Array<keyof DeliveryFeesByMunicipality> = ['Dosquebradas', 'Pereira', 'Cuba'];

const DEFAULT_FEES: DeliveryFeesByMunicipality = {
  Dosquebradas: 12000,
  Pereira: 12000,
  Cuba: 12000,
};

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

export function DeliveryFeesPanel() {
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [fees, setFees] = useState<DeliveryFeesByMunicipality>(DEFAULT_FEES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function applyConfig(config: SystemConfig) {
    setSystemConfig(config);
    setFees(config.deliveryFeesByMunicipality ?? DEFAULT_FEES);
  }

  useEffect(() => {
    let mounted = true;

    getSystemConfig()
      .then((config) => {
        if (!mounted) {
          return;
        }

        applyConfig(config);
        setLoading(false);
      })
      .catch((error: Error) => {
        if (!mounted) {
          return;
        }

        setMessage(error.message);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleReset() {
    if (!systemConfig) {
      return;
    }

    applyConfig(systemConfig);
    setMessage('Valores restaurados desde la configuracion guardada.');
  }

  function handleFeeChange(municipality: keyof DeliveryFeesByMunicipality, rawValue: string) {
    const parsed = Math.trunc(Number(rawValue));
    const nextValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setFees((current) => ({
      ...current,
      [municipality]: nextValue,
    }));
  }

  async function handleSave() {
    setMessage(null);

    const invalidMunicipality = MUNICIPALITIES.find((municipality) => {
      const fee = Number(fees[municipality]);
      return !Number.isFinite(fee) || fee < 0;
    });

    if (invalidMunicipality) {
      setMessage(`El valor de ${invalidMunicipality} debe ser mayor o igual a 0.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSystemConfig({
        deliveryFeesByMunicipality: {
          Dosquebradas: Math.trunc(Number(fees.Dosquebradas)),
          Pereira: Math.trunc(Number(fees.Pereira)),
          Cuba: Math.trunc(Number(fees.Cuba)),
        },
      });
      applyConfig(updated);
      setMessage('Tarifas de domicilio guardadas correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las tarifas.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="app-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Tarifas por municipio</h2>
          <p className="text-sm text-[var(--muted)]">Define cuanto se cobra por domicilio en cada municipio.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]"
          >
            Restaurar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar tarifas'}
          </button>
        </div>
      </div>

      {loading ? <p className="mb-3 text-sm text-[var(--muted)]">Cargando configuracion...</p> : null}
      {message ? <p className="mb-3 rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {MUNICIPALITIES.map((municipality) => (
          <label key={municipality} className="space-y-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{municipality}</span>
            <input
              type="number"
              min={0}
              value={fees[municipality]}
              onChange={(event) => handleFeeChange(municipality, event.target.value)}
              className="app-input"
            />
            <p className="text-xs text-[var(--muted)]">Actual: {formatCop(fees[municipality])}</p>
          </label>
        ))}
      </div>
    </article>
  );
}

export default DeliveryFeesPanel;

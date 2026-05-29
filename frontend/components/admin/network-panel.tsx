'use client';

import { useState } from 'react';
import { getReferralNetwork, getUserByReferralCode } from '@/services/api';
import { ReferralNetwork } from '@/types/domain';

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetworkPanel() {
  const [referralCode, setReferralCode] = useState('');
  const [network, setNetwork] = useState<ReferralNetwork | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSearch() {
    const code = referralCode.trim();
    if (!code) {
      setMessage('Ingresa un codigo de referido');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const user = await getUserByReferralCode(code);
      const networkData = await getReferralNetwork(user.id);
      setNetwork(networkData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo consultar la red');
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <article className="app-card p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Red de referidos</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Consulta la estructura por niveles usando un codigo de referido.</p>

        {message ? <p className="mt-3 rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="w-full space-y-1.5 sm:flex-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Codigo de referido</span>
            <input
              className="app-input uppercase"
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              placeholder="Ej: ABC123"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={loading}
            className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Consultando...' : 'Ver red'}
          </button>
        </div>
      </article>

      {network ? (
        <article className="app-card p-4 sm:p-5">
          <div className="rounded-2xl bg-[var(--surface-50)] p-3">
            <p className="text-sm font-semibold text-[var(--ink)]">{network.root.fullName}</p>
            <p className="text-xs text-[var(--muted)]">Codigo: {network.root.referralCode}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Miembros en red: {network.summary.totalMembers}</p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {network.levels.map((level) => (
              <article key={level.level} className="rounded-2xl border border-[var(--line)] bg-white p-3">
                <p className="text-[11px] text-[var(--muted)]">Nivel {level.level}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">Miembros: {level.count}</p>
                <p className="text-sm text-[var(--accent)]">{formatCop(level.commissionsCop)}</p>
              </article>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

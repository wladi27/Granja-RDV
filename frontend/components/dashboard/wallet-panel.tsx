'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { WalletMovement } from '@/types/domain';
import { createWithdrawalRequest, getUserWalletMovements, getUserWalletSummary } from '@/services/api';
import { normalizeError } from '@/services/error-utils';
import { formatWithdrawalDestination, getDefaultWithdrawalAccount, getWithdrawalAccounts, type WithdrawalAccount } from '@/services/withdrawal-accounts';

interface WalletPanelProps {
  userId: string;
  initialWalletBalanceCop: number;
}

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMovementStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    paid: 'Pagado',
    completed: 'Completado',
    delivered: 'Entregado',
    active: 'Activo',
    inactive: 'Inactivo',
  };

  return labels[status.toLowerCase()] ?? status.replaceAll('_', ' ');
}

function getMovementStatusTone(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved':
    case 'paid':
    case 'completed':
    case 'delivered':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'rejected':
    case 'inactive':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-[var(--line)] bg-white text-[var(--muted)]';
  }
}

const MOVEMENTS_PAGE_SIZE = 20;

export function WalletPanel({ userId, initialWalletBalanceCop }: WalletPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMoreMovements, setIsLoadingMoreMovements] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletBalanceCop, setWalletBalanceCop] = useState(initialWalletBalanceCop);
  const [minWithdrawalCop, setMinWithdrawalCop] = useState(50000);
  const [pendingWithdrawalsCop, setPendingWithdrawalsCop] = useState(0);
  const [movements, setMovements] = useState<WalletMovement[]>([]);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [movementSearchTerm, setMovementSearchTerm] = useState('');

  const [amountInput, setAmountInput] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<WithdrawalAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const movementsSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWalletBalanceCop(initialWalletBalanceCop);
  }, [initialWalletBalanceCop]);

  const loadMovements = async (page: number, append = false) => {
    const response = await getUserWalletMovements(userId, page, MOVEMENTS_PAGE_SIZE);
    setMovementPage(response.page);
    setMovementTotal(response.total);
    setMovements((current) => {
      if (!append) {
        return response.movements;
      }

      const next = [...current];
      const seen = new Set(current.map((movement) => movement.id));
      for (const movement of response.movements) {
        if (seen.has(movement.id)) {
          continue;
        }
        seen.add(movement.id);
        next.push(movement);
      }

      return next;
    });
  };

  const loadWalletData = async () => {
    const summary = await getUserWalletSummary(userId);
    setWalletBalanceCop(summary.walletBalanceCop);
    setMinWithdrawalCop(summary.minWithdrawalCop);
    setPendingWithdrawalsCop(summary.pendingWithdrawalsCop);
    await loadMovements(1);
  };

  useEffect(() => {
    let mounted = true;

    loadWalletData()
      .then(() => {
        if (!mounted) {
          return;
        }
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        setLoadError(normalizeError(requestError, 'No fue posible cargar la información de la billetera.'));
      })
      .finally(() => {
        if (!mounted) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const accounts = getWithdrawalAccounts(userId);
    setSavedAccounts(accounts);

    const defaultAccount = getDefaultWithdrawalAccount(userId);
    if (defaultAccount) {
      setSelectedAccountId(defaultAccount.id);
      setDestination(formatWithdrawalDestination(defaultAccount));
    }
  }, [userId]);

  const hasMoreMovements = useMemo(() => movements.length < movementTotal, [movements.length, movementTotal]);
  const normalizedMovementSearch = movementSearchTerm.trim().toLowerCase();
  const visibleMovements = useMemo(() => {
    if (!normalizedMovementSearch) {
      return movements;
    }

    return movements.filter((movement) => {
      const searchableText = [
        movement.label,
        movement.type,
        movement.status,
        formatDate(movement.date),
        formatCop(Math.abs(movement.amountCop)),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedMovementSearch);
    });
  }, [movements, normalizedMovementSearch]);

  const onRequestWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const amountCop = Number.parseInt(amountInput.replace(/\D/g, ''), 10);
    if (!Number.isInteger(amountCop) || amountCop <= 0) {
      setError('Ingresa un monto válido para el retiro.');
      return;
    }

    if (amountCop < minWithdrawalCop) {
      setError(`El retiro mínimo es ${formatCop(minWithdrawalCop)}.`);
      return;
    }

    if (amountCop > walletBalanceCop) {
      setError('No tienes saldo suficiente para este retiro.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createWithdrawalRequest({
        amountCop,
        destination: destination.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      await loadWalletData();
      setAmountInput('');
      setDestination('');
      setNotes('');
      setSuccess('Solicitud de retiro enviada. Queda pendiente de aprobación por administración.');
      setIsModalOpen(false);
    } catch (submitError) {
      setError(normalizeError(submitError, 'No fue posible crear la solicitud de retiro.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalVisible = isModalOpen && !isLoading;

  const loadMoreMovements = async () => {
    if (!hasMoreMovements || isLoadingMoreMovements || isLoading) {
      return;
    }

    try {
      setIsLoadingMoreMovements(true);
      await loadMovements(movementPage + 1, true);
    } catch (movementError) {
      setLoadError(normalizeError(movementError, 'No fue posible cargar más movimientos.'));
    } finally {
      setIsLoadingMoreMovements(false);
    }
  };

  useEffect(() => {
    if (isLoading || isLoadingMoreMovements || !hasMoreMovements) {
      return;
    }

    const sentinel = movementsSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        void loadMoreMovements();
      },
      {
        root: null,
        rootMargin: '220px 0px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [isLoading, isLoadingMoreMovements, hasMoreMovements, movementPage]);

  return (
    <section id="wallet" className="app-card scroll-mt-24 overflow-hidden p-0">
      <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#1f5f96_0%,#1b3d6b_40%,#0f243d_100%)] px-5 py-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Billetera</p>
        <h3 className="mt-2 text-3xl font-semibold">{formatCop(walletBalanceCop)}</h3>
        <p className="mt-1 text-sm text-white/80">Saldo disponible en tu cuenta.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Retiro mínimo</p>
            <p className="text-sm font-semibold">{formatCop(minWithdrawalCop)}</p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">Retiros pendientes</p>
            <p className="text-sm font-semibold">{formatCop(pendingWithdrawalsCop)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Solicitud de retiro</h4>
          <p className="mt-1 text-xs text-[var(--muted)]">Envía la solicitud y administración la revisa para aprobarla o rechazarla.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Mínimo permitido</p>
              <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{formatCop(minWithdrawalCop)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Saldo disponible</p>
              <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{formatCop(walletBalanceCop)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Estado del proceso</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">Pendiente</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Aprobado</span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">Rechazado</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setIsModalOpen(true);
            }}
            disabled={isLoading}
            className="mt-4 w-full rounded-xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_12px_30px_rgba(18,74,125,0.25)] transition-transform hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Solicitar retiro
          </button>
          {success ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
          {loadError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p> : null}
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Movimientos</h4>
          <p className="mt-1 text-xs text-[var(--muted)]">Comisiones, pagos de pedidos con wallet y solicitudes de retiro.</p>

          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Buscar movimientos</span>
            <input
              type="text"
              value={movementSearchTerm}
              onChange={(event) => setMovementSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              placeholder="Comisión, retiro, estado o fecha"
            />
          </label>

          {isLoading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Cargando movimientos...</p>
          ) : visibleMovements.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              {movements.length === 0 ? 'Aún no hay movimientos.' : 'No hay resultados para tu búsqueda.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {visibleMovements.map((movement) => (
                <li key={movement.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--ink)]">{movement.label}</p>
                    <strong className={movement.amountCop >= 0 ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>
                      {movement.amountCop >= 0 ? '+' : '-'}{formatCop(Math.abs(movement.amountCop))}
                    </strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{formatDate(movement.date)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getMovementStatusTone(movement.status)}`}>
                      {formatMovementStatus(movement.status)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && movements.length > 0 ? (
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
              <p className="text-xs text-[var(--muted)]">Mostrando {visibleMovements.length} coincidencias de {movements.length} cargados ({movementTotal} totales)</p>
              {hasMoreMovements ? (
                <>
                  <div ref={movementsSentinelRef} className="mt-2 h-3 w-full" aria-hidden="true" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                    {isLoadingMoreMovements ? 'Cargando más movimientos...' : 'Desliza para cargar más'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                  Movimientos cargados completos
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {modalVisible ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" onClick={() => setIsModalOpen(false)}>
          <div
            className="w-full max-w-xl rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">Nuevo retiro</p>
                <h5 className="mt-1 text-xl font-semibold text-[var(--ink)]">Solicitar retiro de wallet</h5>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
              >
                Cerrar
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={onRequestWithdrawal}>
              {savedAccounts.length > 0 ? (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Cuenta guardada</span>
                  <div className="flex gap-2">
                    <select
                      value={selectedAccountId}
                      onChange={(event) => {
                        const accountId = event.target.value;
                        setSelectedAccountId(accountId);
                        const selected = savedAccounts.find((account) => account.id === accountId);
                        if (selected) {
                          setDestination(formatWithdrawalDestination(selected));
                        }
                      }}
                      className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      <option value="">Selecciona una cuenta</option>
                      {savedAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {formatWithdrawalDestination(account)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const selected = savedAccounts.find((account) => account.id === selectedAccountId);
                        if (selected) {
                          setDestination(formatWithdrawalDestination(selected));
                        }
                      }}
                      className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]"
                    >
                      Usar
                    </button>
                  </div>
                </label>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No tienes cuentas guardadas. Puedes agregarlas en Perfil / Cuentas de retiro.
                </p>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Monto (COP)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  placeholder="Ej: 50000"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {[minWithdrawalCop, Math.floor(walletBalanceCop * 0.5), walletBalanceCop]
                    .filter((value, index, array) => value > 0 && array.indexOf(value) === index)
                    .map((quickAmount) => (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => setAmountInput(String(quickAmount))}
                        className="rounded-full border border-[var(--line)] bg-[var(--surface-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)]"
                      >
                        {formatCop(quickAmount)}
                      </button>
                    ))}
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Destino</span>
                <input
                  type="text"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  placeholder="Nequi, banco, cuenta, etc."
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Notas</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="h-24 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  placeholder="Opcional"
                />
              </label>

              {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--muted)]">Mínimo actual: {formatCop(minWithdrawalCop)}</p>
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Enviando...' : 'Confirmar retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

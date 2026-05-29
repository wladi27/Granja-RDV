'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSystemConfig, updateSystemConfig } from '@/services/api';
import { PaymentAccountConfig, PaymentMethod, SystemConfig } from '@/types/domain';

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string; description: string }> = [
  {
    value: 'wallet',
    label: 'Wallet',
    description: 'Saldo interno del usuario.',
  },
  {
    value: 'bank_transfer',
    label: 'Transferencia bancaria',
    description: 'Pago por cuenta bancaria con comprobante.',
  },
  {
    value: 'mobile_payment',
    label: 'Pago movil',
    description: 'Pago por numero movil con comprobante.',
  },
  {
    value: 'cash',
    label: 'Efectivo',
    description: 'Pago en efectivo con validacion directa administrativa.',
  },
];

interface PaymentAccountDraft {
  id: string | null;
  method: PaymentMethod;
  label: string;
  holderName: string;
  accountRef: string;
  details: string;
}

const EMPTY_DRAFT: PaymentAccountDraft = {
  id: null,
  method: 'bank_transfer',
  label: '',
  holderName: '',
  accountRef: '',
  details: '',
};

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `account-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatPaymentMethodLabel(method: PaymentMethod): string {
  const item = PAYMENT_METHOD_OPTIONS.find((option) => option.value === method);
  return item?.label ?? method;
}

export function PaymentMethodsPanel() {
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>([
    'wallet',
    'bank_transfer',
    'mobile_payment',
    'cash',
  ]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountConfig[]>([]);
  const [draft, setDraft] = useState<PaymentAccountDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const enabledMethodsSet = useMemo(() => new Set(enabledPaymentMethods), [enabledPaymentMethods]);

  function applyConfig(configData: SystemConfig) {
    setSystemConfig(configData);
    setEnabledPaymentMethods(configData.enabledPaymentMethods);
    setPaymentAccounts(configData.paymentAccounts ?? []);
    setDraft(EMPTY_DRAFT);
  }

  useEffect(() => {
    let mounted = true;

    getSystemConfig()
      .then((configData) => {
        if (!mounted) {
          return;
        }

        applyConfig(configData);
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

  function handleTogglePaymentMethod(method: PaymentMethod) {
    setEnabledPaymentMethods((current) => {
      if (current.includes(method)) {
        return current.filter((item) => item !== method);
      }

      return [...current, method];
    });
  }

  function handleEditAccount(account: PaymentAccountConfig) {
    setDraft({
      id: account.id,
      method: account.method,
      label: account.label,
      holderName: account.holderName,
      accountRef: account.accountRef,
      details: account.details ?? '',
    });
    setMessage(null);
  }

  async function persistAccounts(nextAccounts: PaymentAccountConfig[], successMessage: string) {
    if (enabledPaymentMethods.length === 0) {
      setMessage('Debes habilitar al menos un metodo de pago.');
      return;
    }

    const accountsForEnabledMethods = nextAccounts.filter((account) => enabledMethodsSet.has(account.method));

    const invalidAccounts = accountsForEnabledMethods.some((account) => {
      const label = account.label.trim();
      const holderName = account.holderName.trim();
      const accountRef = account.accountRef.trim();
      return !label || !holderName || !accountRef;
    });

    if (invalidAccounts) {
      setMessage('Hay cuentas incompletas. Revisa alias, titular y referencia antes de guardar.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateSystemConfig({
        enabledPaymentMethods,
        paymentAccounts: accountsForEnabledMethods,
      });
      applyConfig(updated);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuracion de pagos.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(accountId: string) {
    const nextAccounts = paymentAccounts.filter((account) => account.id !== accountId);
    if (draft.id === accountId) {
      setDraft(EMPTY_DRAFT);
    }
    await persistAccounts(nextAccounts, 'Cuenta eliminada correctamente.');
  }

  async function handleSaveAccount() {
    if (draft.method !== 'bank_transfer' && draft.method !== 'mobile_payment') {
      setMessage('Solo transferencia bancaria y pago movil requieren cuentas configurables.');
      return;
    }

    const label = draft.label.trim();
    const holderName = draft.holderName.trim();
    const accountRef = draft.accountRef.trim();
    const details = draft.details.trim();

    if (!enabledMethodsSet.has(draft.method)) {
      setMessage('Activa el metodo de pago antes de guardar la cuenta.');
      return;
    }

    if (!label || !holderName || !accountRef) {
      setMessage('Completa alias, titular y referencia de la cuenta.');
      return;
    }

    const nextAccount: PaymentAccountConfig = {
      id: draft.id ?? createDraftId(),
      method: draft.method,
      label,
      holderName,
      accountRef,
      details: details || undefined,
    };

    const existingIndex = paymentAccounts.findIndex((account) => account.id === nextAccount.id);
    const nextAccounts =
      existingIndex === -1
        ? [...paymentAccounts, nextAccount]
        : paymentAccounts.map((account, index) => (index === existingIndex ? nextAccount : account));

    setDraft(EMPTY_DRAFT);
    await persistAccounts(
      nextAccounts,
      existingIndex === -1 ? 'Cuenta guardada correctamente.' : 'Cuenta actualizada correctamente.',
    );
  }

  function handleReset() {
    if (!systemConfig) {
      return;
    }

    applyConfig(systemConfig);
    setMessage('Cambios locales descartados.');
  }

  async function handlePersistChanges() {
    await persistAccounts(paymentAccounts, 'Metodos de pago actualizados correctamente.');
  }

  return (
    <article className="app-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Metodos de pago</h2>
          <p className="text-sm text-[var(--muted)]">Configura metodos activos y cuentas para que el cliente sepa a donde pagar.</p>
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
            onClick={() => void handlePersistChanges()}
            disabled={saving}
            className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {loading ? <p className="mb-3 text-sm text-[var(--muted)]">Cargando configuracion...</p> : null}
      {message ? <p className="mb-3 rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Metodos habilitados</h3>
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            {enabledPaymentMethods.length} activos
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {PAYMENT_METHOD_OPTIONS.map((option) => {
            const enabled = enabledMethodsSet.has(option.value);
            return (
              <label
                key={option.value}
                className={`flex items-start justify-between gap-3 rounded-2xl border px-3 py-2.5 transition ${
                  enabled ? 'border-emerald-200 bg-emerald-50/70' : 'border-[var(--line)] bg-white'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)]">{option.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{option.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleTogglePaymentMethod(option.value)}
                  className="mt-1 h-4 w-4 accent-emerald-600"
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Crear o editar cuenta</h3>
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            {draft.id ? 'Editando' : 'Nueva'}
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Metodo</span>
            <select
              value={draft.method}
              onChange={(event) => setDraft((current) => ({ ...current, method: event.target.value as PaymentMethod }))}
              className="app-input"
            >
              {PAYMENT_METHOD_OPTIONS.filter(
                (option) => option.value === 'bank_transfer' || option.value === 'mobile_payment',
              ).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Alias</span>
            <input
              type="text"
              value={draft.label}
              onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
              className="app-input"
              placeholder="Ej: Bancolombia principal"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Titular</span>
            <input
              type="text"
              value={draft.holderName}
              onChange={(event) => setDraft((current) => ({ ...current, holderName: event.target.value }))}
              className="app-input"
              placeholder="Nombre del titular"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Referencia</span>
            <input
              type="text"
              value={draft.accountRef}
              onChange={(event) => setDraft((current) => ({ ...current, accountRef: event.target.value }))}
              className="app-input"
              placeholder="Cuenta, celular o referencia"
            />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Detalle adicional (opcional)
            </span>
            <textarea
              value={draft.details}
              onChange={(event) => setDraft((current) => ({ ...current, details: event.target.value }))}
              className="app-input min-h-[76px]"
              placeholder="Tipo de cuenta, documento, pasos, horarios, etc."
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {draft.id ? (
            <button
              type="button"
              onClick={() => setDraft(EMPTY_DRAFT)}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
            >
              Cancelar edicion
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveAccount()}
            className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white"
          >
            {draft.id ? 'Actualizar cuenta' : 'Guardar cuenta'}
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Cuentas registradas</h3>
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            {paymentAccounts.length}
          </span>
        </div>

        {paymentAccounts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
            No hay cuentas registradas todavia.
          </p>
        ) : (
          <div className="space-y-2">
            {paymentAccounts.map((account) => (
              <article key={account.id} className="rounded-2xl border border-[var(--line)] bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{account.label}</p>
                    <p className="text-xs text-[var(--muted)]">{formatPaymentMethodLabel(account.method)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditAccount(account)}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount(account.id)}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                  <p>
                    <span className="font-semibold text-[var(--ink)]">Titular:</span> {account.holderName}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--ink)]">Referencia:</span> {account.accountRef}
                  </p>
                  {account.details ? (
                    <p>
                      <span className="font-semibold text-[var(--ink)]">Detalle:</span> {account.details}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

export default PaymentMethodsPanel;

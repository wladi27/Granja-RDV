'use client';

import { useEffect, useState } from 'react';
import { getSystemConfig, updateSystemConfig } from '@/services/api';
import { CommissionLevelConfig, PaymentAccountConfig, PaymentMethod, SystemConfig } from '@/types/domain';

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string; description: string }> = [
  {
    value: 'wallet',
    label: 'Wallet',
    description: 'Permite pagar con saldo interno del usuario.',
  },
  {
    value: 'bank_transfer',
    label: 'Transferencia bancaria',
    description: 'Requiere comprobante para validacion administrativa.',
  },
  {
    value: 'mobile_payment',
    label: 'Pago movil',
    description: 'Requiere comprobante para validacion administrativa.',
  },
  {
    value: 'cash',
    label: 'Efectivo',
    description: 'Pago en efectivo con validacion directa administrativa.',
  },
];

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SystemConfigPanel() {
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [configCommissionLevels, setConfigCommissionLevels] = useState<CommissionLevelConfig[]>([]);
  const [gracePeriodDays, setGracePeriodDays] = useState('3');
  const [minWithdrawalCop, setMinWithdrawalCop] = useState('50000');
  const [deliveryCommissionPercent, setDeliveryCommissionPercent] = useState('0');
  const [maxCommissionLevels, setMaxCommissionLevels] = useState('10');
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>([
    'wallet',
    'bank_transfer',
    'mobile_payment',
    'cash',
  ]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function applyConfig(configData: SystemConfig) {
    setSystemConfig(configData);
    setConfigCommissionLevels(configData.commissionLevels);
    setGracePeriodDays(String(configData.gracePeriodDays));
    setMinWithdrawalCop(String(configData.minWithdrawalCop));
    setDeliveryCommissionPercent(String(configData.deliveryCommissionPercent));
    setMaxCommissionLevels(String(configData.maxCommissionLevels));
    setEnabledPaymentMethods(configData.enabledPaymentMethods);
    setPaymentAccounts(configData.paymentAccounts ?? []);
  }

  function handleTogglePaymentMethod(method: PaymentMethod) {
    setEnabledPaymentMethods((current) => {
      if (current.includes(method)) {
        return current.filter((item) => item !== method);
      }

      return [...current, method];
    });
  }

  function handleAddPaymentAccount() {
    const preferredMethod = enabledPaymentMethods.find((method) => method === 'bank_transfer' || method === 'mobile_payment') ?? 'bank_transfer';
    setPaymentAccounts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        method: preferredMethod,
        label: '',
        holderName: '',
        accountRef: '',
        details: '',
      },
    ]);
  }

  function handleRemovePaymentAccount(accountId: string) {
    setPaymentAccounts((current) => current.filter((account) => account.id !== accountId));
  }

  function handleChangePaymentAccount(accountId: string, patch: Partial<PaymentAccountConfig>) {
    setPaymentAccounts((current) => current.map((account) => (account.id === accountId ? { ...account, ...patch } : account)));
  }

  async function loadConfig() {
    const configData = await getSystemConfig();
    applyConfig(configData);
  }

  useEffect(() => {
    let mounted = true;

    loadConfig()
      .then(() => {
        if (mounted) {
          setLoading(false);
        }
      })
      .catch((error: Error) => {
        if (mounted) {
          setMessage(error.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleAddCommissionLevel() {
    const nextLevel =
      configCommissionLevels.length === 0
        ? 1
        : Math.max(...configCommissionLevels.map((level) => Number(level.level))) + 1;

    setConfigCommissionLevels((current) => [
      ...current,
      {
        level: nextLevel,
        amountCop: 0,
        enabled: true,
      },
    ]);
  }

  function handleRemoveCommissionLevel(indexToRemove: number) {
    setConfigCommissionLevels((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function handleReset() {
    if (systemConfig) {
      applyConfig(systemConfig);
      setMessage('Formulario restaurado con la configuracion guardada');
    }
  }

  async function handleSave() {
    setMessage(null);

    const graceDays = Number(gracePeriodDays);
    const minWithdrawal = Number(minWithdrawalCop);
    const deliveryCommission = Number(deliveryCommissionPercent);
    const maxLevels = Number(maxCommissionLevels);

    if (!Number.isFinite(graceDays) || graceDays < 0 || graceDays > 30) {
      setMessage('Los dias de gracia deben estar entre 0 y 30');
      return;
    }

    if (!Number.isFinite(minWithdrawal) || minWithdrawal < 0) {
      setMessage('El retiro minimo debe ser un numero mayor o igual a 0');
      return;
    }

    if (!Number.isFinite(deliveryCommission) || deliveryCommission < 0 || deliveryCommission > 100) {
      setMessage('La comision de delivery debe estar entre 0 y 100');
      return;
    }

    if (!Number.isFinite(maxLevels) || maxLevels < 1 || maxLevels > 20) {
      setMessage('El maximo de generaciones debe estar entre 1 y 20');
      return;
    }

    if (configCommissionLevels.length === 0) {
      setMessage('Debes configurar al menos una generacion de comision');
      return;
    }

    const normalizedLevels = configCommissionLevels
      .map((level) => ({
        level: Math.max(1, Math.trunc(Number(level.level))),
        amountCop: Math.max(0, Math.trunc(Number(level.amountCop))),
        enabled: Boolean(level.enabled),
      }))
      .sort((a, b) => a.level - b.level)
      .slice(0, maxLevels);

    const duplicatedLevel = normalizedLevels.some((level, index) =>
      normalizedLevels.findIndex((candidate) => candidate.level === level.level) !== index,
    );

    if (duplicatedLevel) {
      setMessage('No puede haber niveles repetidos en las comisiones');
      return;
    }

    if (enabledPaymentMethods.length === 0) {
      setMessage('Debes habilitar al menos un metodo de pago');
      return;
    }

    const normalizedPaymentAccounts = paymentAccounts
      .map((account) => ({
        ...account,
        label: account.label.trim(),
        holderName: account.holderName.trim(),
        accountRef: account.accountRef.trim(),
        details: account.details?.trim() ?? '',
      }))
      .filter((account) => account.label || account.holderName || account.accountRef || account.details)
      .filter((account) => enabledPaymentMethods.includes(account.method));

    if (
      normalizedPaymentAccounts.some(
        (account) => !account.label || !account.holderName || !account.accountRef,
      )
    ) {
      setMessage('Cada cuenta de pago debe tener metodo activo, alias, titular y referencia');
      return;
    }

    const nonWalletMethods = enabledPaymentMethods.filter((method) => method === 'bank_transfer' || method === 'mobile_payment');
    if (
      nonWalletMethods.length > 0 &&
      nonWalletMethods.some((method) => !normalizedPaymentAccounts.some((account) => account.method === method))
    ) {
      setMessage('Configura al menos una cuenta para cada metodo activo distinto de wallet');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSystemConfig({
        gracePeriodDays: graceDays,
        minWithdrawalCop: minWithdrawal,
        deliveryCommissionPercent: deliveryCommission,
        maxCommissionLevels: maxLevels,
        commissionLevels: normalizedLevels,
        enabledPaymentMethods,
        paymentAccounts: normalizedPaymentAccounts,
      });
      applyConfig(updated);
      setMessage('Configuracion del sistema guardada');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuracion');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="app-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Configuracion del sistema</h2>
          <p className="text-sm text-[var(--muted)]">Comisiones, niveles, retiro minimo y reglas globales MLM.</p>
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
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {loading ? <p className="mb-3 text-sm text-[var(--muted)]">Cargando configuracion...</p> : null}
      {message ? <p className="mb-3 rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Dias de gracia</span>
          <input type="number" min={0} max={30} value={gracePeriodDays} onChange={(event) => setGracePeriodDays(event.target.value)} className="app-input" />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Retiro minimo (COP)</span>
          <input type="number" min={0} value={minWithdrawalCop} onChange={(event) => setMinWithdrawalCop(event.target.value)} className="app-input" />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Comision delivery (%)</span>
          <input type="number" min={0} max={100} value={deliveryCommissionPercent} onChange={(event) => setDeliveryCommissionPercent(event.target.value)} className="app-input" />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Maximo generaciones</span>
          <input type="number" min={1} max={20} value={maxCommissionLevels} onChange={(event) => setMaxCommissionLevels(event.target.value)} className="app-input" />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Metodos de pago</h3>
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            {enabledPaymentMethods.length} activos
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {PAYMENT_METHOD_OPTIONS.map((option) => {
            const enabled = enabledPaymentMethods.includes(option.value);
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
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Cuentas de cobro por metodo</h3>
          <button
            type="button"
            onClick={handleAddPaymentAccount}
            className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
          >
            Agregar cuenta
          </button>
        </div>

        {paymentAccounts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--muted)]">
            No hay cuentas configuradas. Agrega al menos una para metodos que requieran pago externo.
          </p>
        ) : (
          <div className="space-y-2">
            {paymentAccounts.map((account, index) => (
              <fieldset key={account.id} className="rounded-2xl border border-[var(--line)] bg-white p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Cuenta {index + 1}</legend>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Metodo</span>
                    <select
                      value={account.method}
                      onChange={(event) => handleChangePaymentAccount(account.id, { method: event.target.value as PaymentMethod })}
                      className="app-input"
                    >
                      {PAYMENT_METHOD_OPTIONS.filter((option) => option.value !== 'wallet').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Alias visible</span>
                    <input
                      type="text"
                      value={account.label}
                      onChange={(event) => handleChangePaymentAccount(account.id, { label: event.target.value })}
                      className="app-input"
                      placeholder="Ej: Bancolombia principal"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Titular</span>
                    <input
                      type="text"
                      value={account.holderName}
                      onChange={(event) => handleChangePaymentAccount(account.id, { holderName: event.target.value })}
                      className="app-input"
                      placeholder="Nombre del titular"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Numero / referencia</span>
                    <input
                      type="text"
                      value={account.accountRef}
                      onChange={(event) => handleChangePaymentAccount(account.id, { accountRef: event.target.value })}
                      className="app-input"
                      placeholder="Cuenta, celular o referencia"
                    />
                  </label>

                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Detalle adicional (opcional)</span>
                    <textarea
                      value={account.details ?? ''}
                      onChange={(event) => handleChangePaymentAccount(account.id, { details: event.target.value })}
                      className="app-input min-h-[76px]"
                      placeholder="Tipo de cuenta, documento, pasos de pago, etc."
                    />
                  </label>
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemovePaymentAccount(account.id)}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    Quitar cuenta
                  </button>
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Comisiones por generacion</h3>
          <button
            type="button"
            onClick={handleAddCommissionLevel}
            className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
          >
            Agregar generacion
          </button>
        </div>

        <div className="space-y-2">
          {configCommissionLevels.map((level, index) => (
            <fieldset key={`${level.level}-${index}`} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Generacion {index + 1}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-[0.8fr_1fr_auto]">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Numero</span>
                  <input
                    type="number"
                    min={1}
                    value={level.level}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setConfigCommissionLevels((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, level: value } : item)));
                    }}
                    className="app-input"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Bono (COP)</span>
                  <input
                    type="number"
                    min={0}
                    value={level.amountCop}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setConfigCommissionLevels((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, amountCop: value } : item)));
                    }}
                    className="app-input"
                  />
                </label>

                <div className="flex items-end gap-2 sm:justify-end">
                  <label className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                    <span>Activa</span>
                    <input
                      type="checkbox"
                      checked={level.enabled}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setConfigCommissionLevels((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, enabled: checked } : item)));
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveCommissionLevel(index)}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {systemConfig ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Guardado actual: {systemConfig.commissionLevels.length} generaciones, retiro minimo {formatCop(systemConfig.minWithdrawalCop)}, {systemConfig.deliveryCommissionPercent}% de comision delivery, {systemConfig.enabledPaymentMethods.length} metodos activos y {systemConfig.paymentAccounts.length} cuentas de cobro.
        </p>
      ) : null}
    </article>
  );
}

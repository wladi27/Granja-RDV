'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { updateUserProfile } from '@/services/api';
import { getAuthSession, setAuthSession } from '@/services/auth-session';
import { normalizeError } from '@/services/error-utils';
import {
  formatWithdrawalDestination,
  getWithdrawalAccounts,
  removeWithdrawalAccount,
  setDefaultWithdrawalAccount,
  upsertWithdrawalAccount,
  type WithdrawalAccount,
  type WithdrawalAccountType,
} from '@/services/withdrawal-accounts';
import { DashboardUser } from '@/types/domain';

interface ProfileSettingsFormProps {
  userId: string;
  user: DashboardUser;
}

type ProfileSection = 'personal' | 'security' | 'withdrawals' | 'preferences';

interface ProfilePreferences {
  emailAlerts: boolean;
  withdrawalReminders: boolean;
  compactView: boolean;
}

const PROFILE_PREFERENCES_KEY_PREFIX = 'grv_profile_preferences';

function getProfilePreferencesKey(userId: string): string {
  return `${PROFILE_PREFERENCES_KEY_PREFIX}:${userId}`;
}

export function ProfileSettingsForm({ userId, user }: ProfileSettingsFormProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');

  const [savedUsername, setSavedUsername] = useState(user.username ?? '');
  const [savedFullName, setSavedFullName] = useState(user.fullName);
  const [savedEmail, setSavedEmail] = useState(user.email);
  const [savedWhatsappPhone, setSavedWhatsappPhone] = useState(user.whatsappPhone ?? '');

  const [username, setUsername] = useState(user.username ?? '');
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [whatsappPhone, setWhatsappPhone] = useState(user.whatsappPhone ?? '');

  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalSuccess, setPersonalSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<WithdrawalAccount[]>([]);
  const [accountType, setAccountType] = useState<WithdrawalAccountType>('bank');
  const [accountLabel, setAccountLabel] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [accountNotes, setAccountNotes] = useState('');
  const [accountAsDefault, setAccountAsDefault] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountsSuccess, setAccountsSuccess] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<ProfilePreferences>({
    emailAlerts: true,
    withdrawalReminders: true,
    compactView: false,
  });
  const [preferencesSuccess, setPreferencesSuccess] = useState<string | null>(null);

  const hasPersonalChanges = useMemo(() => {
    const changedUsername = username.trim().toLowerCase() !== savedUsername.toLowerCase();
    const changedFullName = fullName.trim() !== savedFullName;
    const changedEmail = email.trim().toLowerCase() !== savedEmail.toLowerCase();
    const changedWhatsappPhone = whatsappPhone.trim() !== savedWhatsappPhone.trim();
    return changedUsername || changedFullName || changedEmail || changedWhatsappPhone;
  }, [email, fullName, savedEmail, savedFullName, savedUsername, savedWhatsappPhone, username, whatsappPhone]);

  const hasSecurityChanges = Boolean(currentPassword || newPassword || confirmPassword);

  useEffect(() => {
    setAccounts(getWithdrawalAccounts(userId));

    if (typeof window === 'undefined') {
      return;
    }

    const rawPreferences = window.localStorage.getItem(getProfilePreferencesKey(userId));
    if (!rawPreferences) {
      return;
    }

    try {
      const parsed = JSON.parse(rawPreferences) as Partial<ProfilePreferences>;
      setPreferences((current) => ({
        emailAlerts: parsed.emailAlerts ?? current.emailAlerts,
        withdrawalReminders: parsed.withdrawalReminders ?? current.withdrawalReminders,
        compactView: parsed.compactView ?? current.compactView,
      }));
    } catch {
      // Ignore malformed persisted preferences.
    }
  }, [userId]);

  const onSavePersonal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPersonalError(null);
    setPersonalSuccess(null);

    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedWhatsappPhone = whatsappPhone.trim();

    if (!trimmedUsername) {
      setPersonalError('El nombre de usuario es obligatorio.');
      return;
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(trimmedUsername)) {
      setPersonalError('El nombre de usuario debe tener 3-30 caracteres y usar solo letras, numeros, punto, guion o guion bajo.');
      return;
    }

    if (!trimmedName) {
      setPersonalError('El nombre completo es obligatorio.');
      return;
    }

    if (!trimmedEmail) {
      setPersonalError('El correo es obligatorio.');
      return;
    }

    if (trimmedWhatsappPhone && !/^\+?[0-9()\-\s]{7,20}$/.test(trimmedWhatsappPhone)) {
      setPersonalError('El número de WhatsApp no es válido.');
      return;
    }

    const patch: {
      username?: string;
      fullName?: string;
      email?: string;
      whatsappPhone?: string;
    } = {};

    if (trimmedUsername !== savedUsername.toLowerCase()) {
      patch.username = trimmedUsername;
    }

    if (trimmedName !== savedFullName) {
      patch.fullName = trimmedName;
    }

    if (trimmedEmail !== savedEmail.toLowerCase()) {
      patch.email = trimmedEmail;
    }

    if (trimmedWhatsappPhone !== savedWhatsappPhone.trim()) {
      patch.whatsappPhone = trimmedWhatsappPhone;
    }

    if (!Object.keys(patch).length) {
      setPersonalSuccess('No hay cambios en datos personales.');
      return;
    }

    try {
      setIsSavingPersonal(true);
      const updated = await updateUserProfile(userId, patch);
      setSavedUsername(updated.username ?? '');
      setSavedFullName(updated.fullName);
      setSavedEmail(updated.email);
      setSavedWhatsappPhone(updated.whatsappPhone ?? '');
      setUsername(updated.username ?? '');
      setFullName(updated.fullName);
      setEmail(updated.email);
      setWhatsappPhone(updated.whatsappPhone ?? '');

      const session = getAuthSession();
      if (session && session.user.id === userId) {
        setAuthSession({
          ...session,
          user: {
            ...session.user,
            username: updated.username,
            fullName: updated.fullName,
            email: updated.email,
            whatsappPhone: updated.whatsappPhone,
            role: updated.role,
            permissions: updated.permissions,
            referralCode: updated.referralCode,
          },
        });
      }

      setPersonalSuccess('Datos personales actualizados.');
    } catch (submitError) {
      setPersonalError(normalizeError(submitError, 'No fue posible actualizar los datos personales.'));
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const onSaveSecurity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!hasSecurityChanges) {
      setSecuritySuccess('No hay cambios de seguridad para guardar.');
      return;
    }

    if (!currentPassword) {
      setSecurityError('Ingresa tu contraseña actual para cambiarla.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setSecurityError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError('La confirmación de contraseña no coincide.');
      return;
    }

    try {
      setIsSavingSecurity(true);
      await updateUserProfile(userId, {
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecuritySuccess('Contraseña actualizada correctamente.');
    } catch (submitError) {
      setSecurityError(normalizeError(submitError, 'No fue posible actualizar la contraseña.'));
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const onAddWithdrawalAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountsError(null);
    setAccountsSuccess(null);

    const cleanLabel = accountLabel.trim();
    const cleanHolder = accountHolderName.trim();
    const cleanIdentifier = accountIdentifier.trim();

    if (!cleanLabel) {
      setAccountsError('El nombre de la cuenta es obligatorio.');
      return;
    }

    if (!cleanIdentifier) {
      setAccountsError('El identificador de la cuenta es obligatorio.');
      return;
    }

    const updated = upsertWithdrawalAccount(userId, {
      type: accountType,
      label: cleanLabel,
      holderName: cleanHolder,
      identifier: cleanIdentifier,
      notes: accountNotes,
      isDefault: accountAsDefault,
    });

    setAccounts(updated);
    setAccountLabel('');
    setAccountHolderName('');
    setAccountIdentifier('');
    setAccountNotes('');
    setAccountAsDefault(false);
    setAccountsSuccess('Cuenta de retiro guardada.');
  };

  const onDeleteWithdrawalAccount = (accountId: string) => {
    const updated = removeWithdrawalAccount(userId, accountId);
    setAccounts(updated);
    setAccountsSuccess('Cuenta eliminada.');
  };

  const onSetDefaultAccount = (accountId: string) => {
    const updated = setDefaultWithdrawalAccount(userId, accountId);
    setAccounts(updated);
    setAccountsSuccess('Cuenta marcada como predeterminada.');
  };

  const onCopyToClipboard = async (value: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setAccountsSuccess('Dato copiado al portapapeles.');
    } catch {
      setAccountsError('No fue posible copiar al portapapeles.');
    }
  };

  const onSavePreferences = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getProfilePreferencesKey(userId), JSON.stringify(preferences));
    }

    setPreferencesSuccess('Preferencias guardadas.');
    window.setTimeout(() => setPreferencesSuccess(null), 1800);
  };

  const sections: Array<{ id: ProfileSection; label: string }> = [
    { id: 'personal', label: 'Datos personales' },
    { id: 'security', label: 'Seguridad' },
    { id: 'withdrawals', label: 'Cuentas de retiro' },
    { id: 'preferences', label: 'Otras opciones' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Ruta de configuracion</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sections.map((section, index) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)]'
                }`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-[var(--surface-50)]'}`}>
                  {index + 1}
                </span>
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeSection === 'personal' ? (
        <form className="space-y-4" onSubmit={onSavePersonal}>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Este bloque actualiza nombre de usuario, nombre completo, correo y numero de WhatsApp.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[var(--ink)]">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nombre de usuario</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Ej: juan.perez"
                autoComplete="username"
              />
              <p className="text-[11px] text-[var(--muted)]">Usa de 3 a 30 caracteres: letras, numeros, punto, guion o guion bajo.</p>
            </label>

            <label className="space-y-1 text-sm text-[var(--ink)]">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nombre completo</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Tu nombre"
                autoComplete="name"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--ink)] sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Correo</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--ink)] sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Numero de WhatsApp (opcional)</span>
              <input
                value={whatsappPhone}
                onChange={(event) => setWhatsappPhone(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Ej: +57 300 123 4567"
                autoComplete="tel"
              />
            </label>
          </div>

          {personalError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{personalError}</p> : null}
          {personalSuccess ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{personalSuccess}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">Solo se envia el campo que realmente cambiaste.</p>
            <button
              type="submit"
              disabled={isSavingPersonal || !hasPersonalChanges}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(31,95,150,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-5"
            >
              {isSavingPersonal ? 'Guardando...' : 'Guardar datos personales'}
            </button>
          </div>
        </form>
      ) : null}

      {activeSection === 'security' ? (
        <form className="space-y-4" onSubmit={onSaveSecurity}>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Esta seccion solo actualiza la contrasena. No toca tus datos personales.
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm text-[var(--ink)]">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Contrasena actual</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                autoComplete="current-password"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--ink)]">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nueva contrasena</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                autoComplete="new-password"
              />
            </label>

            <label className="space-y-1 text-sm text-[var(--ink)]">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Confirmar contrasena</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                autoComplete="new-password"
              />
            </label>
          </div>

          {securityError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{securityError}</p> : null}
          {securitySuccess ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{securitySuccess}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">Por seguridad, confirma tu contrasena actual antes de cambiarla.</p>
            <button
              type="submit"
              disabled={isSavingSecurity || !hasSecurityChanges}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(31,95,150,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-5"
            >
              {isSavingSecurity ? 'Actualizando...' : 'Actualizar contrasena'}
            </button>
          </div>
        </form>
      ) : null}

      {activeSection === 'withdrawals' ? (
        <div className="space-y-4">
          <form className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-4 sm:grid-cols-2" onSubmit={onAddWithdrawalAccount}>
            <p className="sm:col-span-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Agregar cuenta de retiro</p>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Tipo</span>
              <select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as WithdrawalAccountType)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
              >
                <option value="bank">Banco</option>
                <option value="nequi">Nequi</option>
                <option value="daviplata">Daviplata</option>
                <option value="other">Otro</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nombre de cuenta</span>
              <input
                value={accountLabel}
                onChange={(event) => setAccountLabel(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Cuenta principal"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Titular</span>
              <input
                value={accountHolderName}
                onChange={(event) => setAccountHolderName(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Nombre del titular"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Numero o identificador</span>
              <input
                value={accountIdentifier}
                onChange={(event) => setAccountIdentifier(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Numero de cuenta o celular"
              />
            </label>

            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Notas</span>
              <input
                value={accountNotes}
                onChange={(event) => setAccountNotes(event.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
                placeholder="Opcional"
              />
            </label>

            <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs text-[var(--ink)]">
              <input
                type="checkbox"
                checked={accountAsDefault}
                onChange={(event) => setAccountAsDefault(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)]"
              />
              Marcar como cuenta predeterminada
            </label>

            <div className="sm:col-span-2 flex justify-stretch sm:justify-end">
              <button
                type="submit"
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(31,95,150,0.24)] transition hover:opacity-95 sm:w-auto sm:px-5"
              >
                Guardar cuenta
              </button>
            </div>
          </form>

          {accountsError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{accountsError}</p> : null}
          {accountsSuccess ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{accountsSuccess}</p> : null}

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Cuentas guardadas</p>
            {accounts.length === 0 ? (
              <p className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">Aun no tienes cuentas de retiro guardadas.</p>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">{formatWithdrawalDestination(account)}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{account.type}</p>
                    </div>
                    {account.isDefault ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Predeterminada</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {!account.isDefault ? (
                      <button
                        type="button"
                        onClick={() => onSetDefaultAccount(account.id)}
                        className="rounded-full border border-[var(--line)] bg-[var(--surface-50)] px-3 py-1.5 font-semibold uppercase tracking-[0.12em] text-[var(--ink)]"
                      >
                        Usar por defecto
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onCopyToClipboard(account.identifier)}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface-50)] px-3 py-1.5 font-semibold uppercase tracking-[0.12em] text-[var(--ink)]"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteWithdrawalAccount(account.id)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-semibold uppercase tracking-[0.12em] text-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeSection === 'preferences' ? (
        <form className="space-y-3" onSubmit={onSavePreferences}>
          <p className="text-xs text-[var(--muted)]">Opciones utiles para personalizar tu experiencia. Se guardan en este dispositivo.</p>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm">
            <span>Notificaciones por correo</span>
            <input
              type="checkbox"
              checked={preferences.emailAlerts}
              onChange={(event) => setPreferences((current) => ({ ...current, emailAlerts: event.target.checked }))}
              className="h-4 w-4 rounded border-[var(--line)]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm">
            <span>Recordatorios de retiro</span>
            <input
              type="checkbox"
              checked={preferences.withdrawalReminders}
              onChange={(event) => setPreferences((current) => ({ ...current, withdrawalReminders: event.target.checked }))}
              className="h-4 w-4 rounded border-[var(--line)]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm">
            <span>Vista compacta de perfil</span>
            <input
              type="checkbox"
              checked={preferences.compactView}
              onChange={(event) => setPreferences((current) => ({ ...current, compactView: event.target.checked }))}
              className="h-4 w-4 rounded border-[var(--line)]"
            />
          </label>

          {preferencesSuccess ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{preferencesSuccess}</p> : null}

          <div className="flex justify-stretch sm:justify-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(31,95,150,0.24)] transition hover:opacity-95 sm:w-auto sm:px-5"
            >
              Guardar preferencias
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getUserDashboard, updateUserProfile } from '@/services/api';
import { getAuthSession, setAuthSession } from '@/services/auth-session';
import { normalizeError } from '@/services/error-utils';
import { DashboardUser } from '@/types/domain';

function formatRoleLabel(role: DashboardUser['role']): string {
  if (role === 'admin') {
    return 'Administrador';
  }
  if (role === 'courier') {
    return 'Repartidor';
  }
  return 'Cliente';
}

export function CourierProfileSection() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMessage, setPersonalMessage] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const sessionUser = getAuthSession()?.user;
  const userId = sessionUser?.id ?? '';

  useEffect(() => {
    let mounted = true;

    if (!userId) {
      window.location.replace('/login?next=%2Fcourier%2Fprofile');
      return;
    }

    getUserDashboard(userId)
      .then((data) => {
        if (!mounted) {
          return;
        }

        setUser(data.user);
        setFullName(data.user.fullName ?? '');
        setUsername(data.user.username ?? '');
        setEmail(data.user.email ?? '');
        setWhatsappPhone(data.user.whatsappPhone ?? '');
        setLoading(false);
      })
      .catch((requestError: Error) => {
        if (!mounted) {
          return;
        }

        setError(requestError.message);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const hasPersonalChanges = useMemo(() => {
    if (!user) {
      return false;
    }

    return (
      fullName.trim() !== (user.fullName ?? '').trim() ||
      username.trim().toLowerCase() !== (user.username ?? '').trim().toLowerCase() ||
      email.trim().toLowerCase() !== (user.email ?? '').trim().toLowerCase() ||
      whatsappPhone.trim() !== (user.whatsappPhone ?? '').trim()
    );
  }, [email, fullName, user, username, whatsappPhone]);

  async function handleSavePersonal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPersonalError(null);
    setPersonalMessage(null);

    if (!user || !userId) {
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanWhatsapp = whatsappPhone.trim();

    if (!cleanUsername) {
      setPersonalError('El nombre de usuario es obligatorio.');
      return;
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      setPersonalError('El usuario debe tener 3 a 30 caracteres y solo letras, números, punto, guion o guion bajo.');
      return;
    }

    if (!cleanName) {
      setPersonalError('El nombre completo es obligatorio.');
      return;
    }

    if (!cleanEmail) {
      setPersonalError('El correo es obligatorio.');
      return;
    }

    const patch: {
      username?: string;
      fullName?: string;
      email?: string;
      whatsappPhone?: string;
    } = {};

    if (cleanUsername !== (user.username ?? '').trim().toLowerCase()) {
      patch.username = cleanUsername;
    }

    if (cleanName !== (user.fullName ?? '').trim()) {
      patch.fullName = cleanName;
    }

    if (cleanEmail !== (user.email ?? '').trim().toLowerCase()) {
      patch.email = cleanEmail;
    }

    if (cleanWhatsapp !== (user.whatsappPhone ?? '').trim()) {
      patch.whatsappPhone = cleanWhatsapp;
    }

    if (!Object.keys(patch).length) {
      setPersonalMessage('No hay cambios por guardar.');
      return;
    }

    try {
      setSavingPersonal(true);
      const updated = await updateUserProfile(userId, patch);
      setUser(updated);
      setFullName(updated.fullName ?? '');
      setUsername(updated.username ?? '');
      setEmail(updated.email ?? '');
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

      setPersonalMessage('Perfil actualizado correctamente.');
    } catch (submitError) {
      setPersonalError(normalizeError(submitError, 'No fue posible actualizar el perfil.'));
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleSaveSecurity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityError(null);
    setSecurityMessage(null);

    if (!userId) {
      return;
    }

    if (!currentPassword) {
      setSecurityError('Ingresa tu contraseña actual.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setSecurityError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    try {
      setSavingSecurity(true);
      await updateUserProfile(userId, {
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityMessage('Contraseña actualizada correctamente.');
    } catch (submitError) {
      setSecurityError(normalizeError(submitError, 'No fue posible actualizar la contraseña.'));
    } finally {
      setSavingSecurity(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Cargando perfil del repartidor...</p>;
  }

  if (error || !user) {
    return <div className="app-card border-red-200 bg-red-50 p-4 text-red-700">Error cargando perfil: {error ?? 'No se encontró la cuenta.'}</div>;
  }

  return (
    <section className="space-y-4">
      <section className="app-card overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-5 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Perfil repartidor</p>
          <h1 className="mt-2 text-2xl font-semibold">Mi cuenta</h1>
          <p className="mt-1 text-sm text-white/85">Administra tus datos personales y la seguridad de acceso.</p>
        </div>
        <div className="grid gap-3 border-t border-[var(--line)] bg-white px-5 py-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Rol</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatRoleLabel(user.role)}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Usuario</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{user.username ?? 'Sin usuario'}</p>
          </div>
        </div>
      </section>

      <section className="app-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Datos personales</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSavePersonal}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nombre completo</label>
            <input className="app-input" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Usuario</label>
            <input className="app-input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Correo</label>
            <input type="email" className="app-input" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">WhatsApp</label>
            <input className="app-input" value={whatsappPhone} onChange={(event) => setWhatsappPhone(event.target.value)} />
          </div>
          {personalError ? <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{personalError}</p> : null}
          {personalMessage ? <p className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{personalMessage}</p> : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingPersonal || !hasPersonalChanges}
              className="rounded-xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingPersonal ? 'Guardando...' : 'Guardar datos'}
            </button>
          </div>
        </form>
      </section>

      <section className="app-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Seguridad</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSaveSecurity}>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Contraseña actual</label>
            <input type="password" className="app-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Nueva contraseña</label>
            <input type="password" className="app-input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Confirmar contraseña</label>
            <input type="password" className="app-input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          {securityError ? <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{securityError}</p> : null}
          {securityMessage ? <p className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{securityMessage}</p> : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={savingSecurity}
              className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-60"
            >
              {savingSecurity ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

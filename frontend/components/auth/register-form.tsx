'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { register } from '@/services/register';
import { isUuidV4, setAuthSession } from '@/services/auth-session';
import { normalizeError } from '@/services/error-utils';
import { getPostLoginRoute } from '@/services/post-login-route';

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sponsorCode, setSponsorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const trimmedUsername = username.trim().toLowerCase();
      if (!trimmedUsername) {
        throw new Error('El username es obligatorio.');
      }

      if (!/^[a-z0-9._-]{3,30}$/.test(trimmedUsername)) {
        throw new Error('El username debe tener 3-30 caracteres y usar solo letras, números, punto, guion o guion bajo.');
      }

      if (password !== confirmPassword) {
        throw new Error('La confirmación de contraseña no coincide.');
      }

      const response = await register({
        fullName,
        username: trimmedUsername,
        email,
        password,
        sponsorCode: sponsorCode.trim() || undefined,
      });

      if (!response.user.id || !isUuidV4(response.user.id)) {
        throw new Error('Register response missing a valid user id');
      }

      setAuthSession({
        user: response.user,
        accessToken: response.tokens.accessToken,
        refreshToken: response.tokens.refreshToken,
      });

      const nextPath = new URL(window.location.href).searchParams.get('next');
      window.location.replace(
        getPostLoginRoute(
          {
            user: response.user,
          },
          nextPath,
        ),
      );
    } catch (submitError) {
      setError(normalizeError(submitError, 'No fue posible crear la cuenta.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="app-card space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Alta de usuario</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">Crear cuenta</h2>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="fullName">
          Nombre completo
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="app-input"
          placeholder="Nombre y apellido"
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          className="app-input"
          placeholder="usuario"
          autoComplete="username"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="app-input"
          placeholder="correo@ejemplo.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="app-input pr-12"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--accent)] transition hover:bg-slate-100"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 102.83 2.83" />
                <path d="M16.68 16.67A10.94 10.94 0 0112 18c-7 0-10-6-10-6a18.7 18.7 0 014.19-5.23" />
                <path d="M9.88 4.24A10.94 10.94 0 0112 4c7 0 10 6 10 6a18.67 18.67 0 01-3.05 4.28" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="confirmPassword">
          Confirmar contraseña
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="app-input pr-12"
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--accent)] transition hover:bg-slate-100"
            aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
            title={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
          >
            {showConfirmPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 102.83 2.83" />
                <path d="M16.68 16.67A10.94 10.94 0 0112 18c-7 0-10-6-10-6a18.7 18.7 0 014.19-5.23" />
                <path d="M9.88 4.24A10.94 10.94 0 0112 4c7 0 10 6 10 6a18.67 18.67 0 01-3.05 4.28" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="sponsorCode">
          Código de patrocinador (opcional)
        </label>
        <input
          id="sponsorCode"
          type="text"
          value={sponsorCode}
          onChange={(event) => setSponsorCode(event.target.value)}
          className="app-input uppercase"
          placeholder="Si tienes uno"
        />
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-sky-900/20 transition hover:translate-y-[-1px] disabled:opacity-60"
      >
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-xs text-[var(--muted)]">
        ¿Ya tienes cuenta?{' '}
        <Link className="font-semibold text-[var(--accent)]" href="/login">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

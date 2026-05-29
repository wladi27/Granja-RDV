'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { login } from '@/services/auth';
import { isUuidV4, setAuthSession } from '@/services/auth-session';
import { normalizeError } from '@/services/error-utils';
import { getPostLoginRoute } from '@/services/post-login-route';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await login(email, password);
      if (!response.user.id || !isUuidV4(response.user.id)) {
        throw new Error('Login response missing a valid user id');
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
      setError(normalizeError(submitError, 'No fue posible iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="app-card space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Ingreso seguro</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">Iniciar sesión</h2>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="app-input"
          placeholder="correo@empresa.com"
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
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
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

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-md shadow-sky-900/20 transition hover:translate-y-[-1px] disabled:opacity-60"
      >
        {loading ? 'Ingresando...' : 'Entrar'}
      </button>

      <p className="text-xs text-[var(--muted)]">
        ¿No tienes cuenta?{' '}
        <Link className="font-semibold text-[var(--accent)]" href="/register">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

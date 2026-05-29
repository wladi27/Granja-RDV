'use client';

import { FormEvent, useState } from 'react';
import { login } from '@/services/auth';
import { isUuidV4, setAuthSession } from '@/services/auth-session';
import { normalizeError } from '@/services/error-utils';
import { getPostLoginRoute } from '@/services/post-login-route';

export function LoginForm() {
  const [email, setEmail] = useState('admin@grv.local');
  const [password, setPassword] = useState('Admin12345!');
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
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">Abre tu sesión</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Accede con tu correo y contraseña.</p>
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
          placeholder="admin@grv.local"
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
            className="app-input pr-24"
            placeholder="Admin12345!"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
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

      <p className="text-xs leading-6 text-[var(--muted)]">
        Acceso para administradores, clientes y repartidores con autenticación centralizada.
      </p>
    </form>
  );
}

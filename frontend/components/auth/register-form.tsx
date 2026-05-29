'use client';

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
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">Crear perfil</h2>
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
          placeholder="Tu nombre"
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
          placeholder="Ej: juanperez"
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
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="app-input"
          placeholder="Minimo 8 caracteres"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--ink)]" htmlFor="sponsorCode">
          Codigo de patrocinador opcional
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
        {loading ? 'Creando cuenta...' : 'Registrarme'}
      </button>

      <p className="text-xs leading-6 text-[var(--muted)]">
        Tu código de referido se genera automáticamente al crear tu cuenta.
      </p>
    </form>
  );
}

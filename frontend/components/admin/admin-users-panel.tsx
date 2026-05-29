'use client';

import { useEffect, useMemo, useState } from 'react';
import { createAdminUser, getAdminUsers, updateAdminUser } from '@/services/api';
import { AdminPermission, AdminUserRow } from '@/types/domain';

const ADMIN_PAGE_SIZE = 8;

const ADMIN_PERMISSION_OPTIONS: AdminPermission[] = [
  '*',
  'dashboard.view',
  'orders.view',
  'orders.manage',
  'inventory.manage',
  'withdrawals.manage',
  'config.manage',
  'users.manage',
  'wallet.manage',
];

function formatAdminPermissionLabel(permission: AdminPermission): string {
  const labels: Record<AdminPermission, string> = {
    '*': 'Todos los permisos',
    'dashboard.view': 'Ver dashboard',
    'orders.view': 'Ver ordenes',
    'orders.manage': 'Gestionar ordenes',
    'inventory.manage': 'Gestionar inventario',
    'withdrawals.manage': 'Gestionar retiros',
    'config.manage': 'Gestionar configuracion',
    'users.manage': 'Gestionar usuarios',
    'wallet.manage': 'Gestionar wallet',
  };

  return labels[permission] ?? permission;
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<AdminPermission[]>(['dashboard.view']);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }

    return users.filter((user) => {
      const name = user.fullName.toLowerCase();
      const username = (user.username ?? '').toLowerCase();
      const email = user.email.toLowerCase();
      return name.includes(term) || username.includes(term) || email.includes(term);
    });
  }, [search, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ADMIN_PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * ADMIN_PAGE_SIZE;
    return filteredUsers.slice(start, start + ADMIN_PAGE_SIZE);
  }, [filteredUsers, page]);

  async function loadUsers() {
    const usersData = await getAdminUsers();
    setUsers(usersData);
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(usersData.length / ADMIN_PAGE_SIZE))));
  }

  useEffect(() => {
    let mounted = true;
    loadUsers()
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  function resetForm() {
    setEditingId(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setPermissions(['dashboard.view']);
  }

  function startEdit(user: AdminUserRow) {
    setEditingId(user.id);
    setFullName(user.fullName);
    setUsername(user.username ?? '');
    setEmail(user.email);
    setPassword('');
    setPermissions(user.permissions.length ? user.permissions : ['dashboard.view']);
  }

  function togglePermission(permission: AdminPermission) {
    setPermissions((current) => {
      const exists = current.includes(permission);
      const next = exists ? current.filter((item) => item !== permission) : [...current, permission];
      return next.length ? next : ['dashboard.view'];
    });
  }

  async function handleSubmit() {
    setMessage(null);
    setSaving(true);

    try {
      if (editingId) {
        await updateAdminUser(editingId, {
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          password: password.trim() || undefined,
          permissions,
        });
        setMessage('Admin actualizado');
      } else {
        await createAdminUser({
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          password: password.trim(),
          permissions,
        });
        setMessage('Admin creado');
      }

      await loadUsers();
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el admin');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <article className="app-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Admins</h2>
            <p className="text-sm text-[var(--muted)]">Crea o actualiza usuarios administradores con permisos personalizados.</p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
            >
              Cancelar edicion
            </button>
          ) : null}
        </div>

        {message ? <p className="mb-3 rounded-xl bg-[var(--surface-50)] px-3 py-2 text-sm text-[var(--ink)]">{message}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Nombre completo</span>
            <input className="app-input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ej: Maria Perez" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Usuario</span>
            <input className="app-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ej: mariap" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Correo</span>
            <input type="email" className="app-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@empresa.com" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Contrasena {editingId ? '(opcional)' : ''}
            </span>
            <input type="password" className="app-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 8 caracteres" />
          </label>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Permisos</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ADMIN_PERMISSION_OPTIONS.map((permission) => (
              <label key={permission} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink)]">
                <span>{formatAdminPermissionLabel(permission)}</span>
                <input
                  type="checkbox"
                  checked={permissions.includes(permission)}
                  onChange={() => togglePermission(permission)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar admin' : 'Crear admin'}
          </button>
        </div>
      </article>

      <article className="app-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--ink)]">Listado de admins</h3>
          <span className="text-xs text-[var(--muted)]">{filteredUsers.length} de {users.length} registros</span>
        </div>

        <label className="mb-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Filtrar admins</span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="app-input"
            placeholder="Buscar por nombre, usuario o correo"
          />
        </label>

        {loading ? <p className="text-sm text-[var(--muted)]">Cargando admins...</p> : null}

        {!loading && users.length === 0 ? <p className="text-sm text-[var(--muted)]">No hay admins adicionales registrados.</p> : null}

        {!loading && users.length > 0 && filteredUsers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay admins para ese filtro.</p>
        ) : null}

        {!loading && filteredUsers.length > 0 ? (
          <div className="space-y-2">
            {paginatedUsers.map((user) => (
              <article key={user.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{user.fullName}</p>
                    <p className="text-xs text-[var(--muted)]">{user.username ?? 'Sin usuario'} · {user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(user)}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                  >
                    Editar
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.permissions.map((permission) => (
                    <span key={permission} className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-[11px] text-[var(--muted)]">
                      {formatAdminPermissionLabel(permission)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {filteredUsers.length > ADMIN_PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-xs text-[var(--muted)]">Pagina {page} de {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </article>
    </section>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { createCourierUser, getCourierUsers, updateCourierUser } from '@/services/api';
import { AdminCourierRow } from '@/types/domain';

const COURIER_PAGE_SIZE = 8;

export function CourierUsersPanel() {
  const [couriers, setCouriers] = useState<AdminCourierRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const filteredCouriers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return couriers;
    }

    return couriers.filter((courier) => {
      const name = courier.fullName.toLowerCase();
      const username = (courier.username ?? '').toLowerCase();
      const email = courier.email.toLowerCase();
      const whatsappPhone = (courier.whatsappPhone ?? '').toLowerCase();
      return name.includes(term) || username.includes(term) || email.includes(term) || whatsappPhone.includes(term);
    });
  }, [couriers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCouriers.length / COURIER_PAGE_SIZE));
  const paginatedCouriers = useMemo(() => {
    const start = (page - 1) * COURIER_PAGE_SIZE;
    return filteredCouriers.slice(start, start + COURIER_PAGE_SIZE);
  }, [filteredCouriers, page]);

  async function loadCouriers() {
    const couriersData = await getCourierUsers();
    setCouriers(couriersData);
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(couriersData.length / COURIER_PAGE_SIZE))));
  }

  useEffect(() => {
    let mounted = true;
    loadCouriers()
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
    setWhatsappPhone('');
    setPassword('');
  }

  function startEdit(courier: AdminCourierRow) {
    setEditingId(courier.id);
    setFullName(courier.fullName);
    setUsername(courier.username ?? '');
    setEmail(courier.email);
    setWhatsappPhone(courier.whatsappPhone ?? '');
    setPassword('');
  }

  async function handleSubmit() {
    setMessage(null);
    setSaving(true);

    try {
      if (editingId) {
        await updateCourierUser(editingId, {
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          whatsappPhone: whatsappPhone.trim(),
          password: password.trim() || undefined,
        });
        setMessage('Repartidor actualizado');
      } else {
        await createCourierUser({
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          whatsappPhone: whatsappPhone.trim(),
          password: password.trim(),
        });
        setMessage('Repartidor creado');
      }

      await loadCouriers();
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el repartidor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <article className="app-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Repartidores</h2>
            <p className="text-sm text-[var(--muted)]">Crea o actualiza repartidores con usuario, correo, WhatsApp y contrasena.</p>
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
            <input className="app-input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ej: Carlos Rojas" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Usuario</span>
            <input className="app-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ej: crojas" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Correo</span>
            <input type="email" className="app-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="repartidor@empresa.com" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">WhatsApp</span>
            <input className="app-input" value={whatsappPhone} onChange={(event) => setWhatsappPhone(event.target.value)} placeholder="Ej: +57 3000000000" />
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Contrasena {editingId ? '(opcional)' : ''}
            </span>
            <input type="password" className="app-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 8 caracteres" />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="rounded-full bg-[linear-gradient(135deg,#1f5f96,#29b394)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar repartidor' : 'Crear repartidor'}
          </button>
        </div>
      </article>

      <article className="app-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--ink)]">Listado de repartidores</h3>
          <span className="text-xs text-[var(--muted)]">{filteredCouriers.length} de {couriers.length} registros</span>
        </div>

        <label className="mb-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Filtrar repartidores</span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="app-input"
            placeholder="Buscar por nombre, usuario, correo o WhatsApp"
          />
        </label>

        {loading ? <p className="text-sm text-[var(--muted)]">Cargando repartidores...</p> : null}

        {!loading && couriers.length === 0 ? <p className="text-sm text-[var(--muted)]">No hay repartidores registrados.</p> : null}

        {!loading && couriers.length > 0 && filteredCouriers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No hay repartidores para ese filtro.</p>
        ) : null}

        {!loading && filteredCouriers.length > 0 ? (
          <div className="space-y-2">
            {paginatedCouriers.map((courier) => (
              <article key={courier.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{courier.fullName}</p>
                    <p className="text-xs text-[var(--muted)]">{courier.username ?? 'Sin usuario'} · {courier.email}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">WhatsApp: {courier.whatsappPhone ?? 'Sin registro'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(courier)}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {filteredCouriers.length > COURIER_PAGE_SIZE ? (
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

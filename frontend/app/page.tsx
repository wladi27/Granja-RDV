import Link from 'next/link';

const operationalHighlights = [
  {
    title: 'Operación diaria centralizada',
    description: 'Gestiona pedidos, pagos, inventario y entregas desde un solo panel.',
  },
  {
    title: 'Flujo comercial trazable',
    description: 'Cada estado del pedido queda registrado para control y auditoría.',
  },
  {
    title: 'Escalable por roles',
    description: 'Administra clientes, repartidores y administradores con permisos claros.',
  },
];

const quickStats = [
  { label: 'Control de pedidos', value: '100%' },
  { label: 'Seguimiento de entregas', value: 'En tiempo real' },
  { label: 'Validación de pagos', value: 'Con trazabilidad' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(120deg,#0f2f52_0%,#1f5f96_45%,#2aa08f_100%)] px-5 py-8 text-white shadow-[0_22px_64px_rgba(16,42,67,0.24)] sm:px-8 sm:py-10 md:px-10 md:py-12">
        <div className="pointer-events-none absolute -top-24 right-[-8rem] h-72 w-72 rounded-full bg-white/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-8rem] h-72 w-72 rounded-full bg-black/15 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">Granja Raiz de Vida</p>
            <h1 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-[2.75rem]">
              Plataforma profesional para la operación comercial y logística.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 sm:text-base">
              Coordina ventas, pedidos, pagos y entregas en una experiencia clara para tu equipo y tus clientes.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex min-w-[170px] items-center justify-center rounded-full bg-[#0f2f52] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:translate-y-[-1px] hover:bg-[#123b66]"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="inline-flex min-w-[170px] items-center justify-center rounded-full border border-white/55 bg-white/12 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/24"
              >
                Crear cuenta
              </Link>
            </div>
          </div>

          <aside className="grid gap-3 rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-5">
            {quickStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/18 bg-black/10 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <section className="mt-7 grid gap-4 md:grid-cols-3">
        {operationalHighlights.map((item) => (
          <article key={item.title} className="app-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

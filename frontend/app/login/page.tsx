import { LoginForm } from '@/components/auth/login-form';
import { LoginRedirectGate } from '@/components/auth/login-redirect-gate';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-4 md:px-6 md:pt-6">
      <LoginRedirectGate />
      <section className="grid gap-4 lg:grid-cols-[1fr_0.92fr] lg:items-start">
        <div className="app-card overflow-hidden p-0">
          <div className="bg-[radial-gradient(130%_130%_at_0%_0%,#2f84d6_0%,#1f5f96_38%,#112d4a_100%)] px-5 py-7 text-white sm:px-6 sm:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Acceso</p>
            <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">Ingresa a tu panel operativo</h1>
            <p className="mt-3 text-sm leading-7 text-white/85">
              Accede de forma segura para continuar con la gestión de pedidos, pagos y entregas.
            </p>
          </div>

          <div className="grid gap-2 p-4 text-sm sm:grid-cols-3 sm:p-5">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Pedidos</p>
              <p className="mt-1 font-semibold text-[var(--ink)]">Control por estado</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Cobros</p>
              <p className="mt-1 font-semibold text-[var(--ink)]">Validación de pagos</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Logística</p>
              <p className="mt-1 font-semibold text-[var(--ink)]">Asignación de reparto</p>
            </div>
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}

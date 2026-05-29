import { LoginForm } from '@/components/auth/login-form';
import { LoginRedirectGate } from '@/components/auth/login-redirect-gate';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-4 md:px-6 md:pt-6">
      <LoginRedirectGate />
      <section className="grid gap-4 lg:grid-cols-[1fr_0.92fr] lg:items-start">
        <div className="app-card overflow-hidden p-0">
          <div className="bg-[radial-gradient(120%_120%_at_0%_0%,#1f5f96_0%,#1b3d6b_40%,#0f243d_100%)] px-5 py-6 text-white sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Acceso</p>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Bienvenido a Granja Raíz de Vida</h1>
            <p className="mt-2 text-sm leading-7 text-white/80">
              Inicia sesión para gestionar pedidos, red de usuarios, wallet y operación diaria desde una sola plataforma.
            </p>
          </div>

          <div className="grid gap-2 p-4 text-sm sm:grid-cols-3 sm:p-5">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Dashboard</p>
              <p className="mt-1 font-semibold text-[var(--ink)]">Control central</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Órdenes</p>
              <p className="mt-1 font-semibold text-[var(--ink)]">Seguimiento en tiempo real</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Wallet</p>
              <p className="mt-1 font-semibold text-[var(--ink)]">Movimientos y retiros</p>
            </div>
          </div>

          <div className="border-t border-[var(--line)] bg-white px-4 py-4 text-sm sm:px-5">
            <p className="font-semibold text-[var(--ink)]">Credenciales demo admin</p>
            <p className="mt-1 text-[var(--muted)]">Email: admin@grv.local</p>
            <p className="text-[var(--muted)]">Contraseña: Admin12345!</p>
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}

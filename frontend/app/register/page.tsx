import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-6 md:px-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <div className="app-card p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Registro</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Crea tu cuenta comercial</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Te damos un código de referido automático y puedes vincular patrocinador opcional para entrar en la red.</p>

          <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] p-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--ink)]">Requisitos</p>
            <p className="mt-2">Nombre completo, email válido y contraseña de mínimo 8 caracteres.</p>
          </div>
        </div>

        <RegisterForm />
      </section>
    </main>
  );
}

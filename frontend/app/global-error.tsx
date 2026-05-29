'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="bg-slate-50 p-6">
        <main className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-red-700">Ocurrio un error inesperado</h2>
          <p className="mt-2 text-sm text-slate-600">{error.message || 'Error desconocido'}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}

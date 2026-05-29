import { AdminMenu } from '@/components/admin/admin-menu';
import { NetworkPanel } from '@/components/admin/network-panel';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function AdminConfigNetworkPage() {
	return (
		<main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
			<section className="app-card p-5 sm:p-6">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Panel admin</p>
				<h1 className="mt-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">Configuracion de red</h1>
				<p className="mt-2 text-sm text-[var(--muted)]">Vista separada para consultar arbol de referidos por codigo.</p>
			</section>

			<AdminMenu />

			<section className="mt-4">
				<NetworkPanel />
			</section>

			<AppBottomNav role="admin" />
		</main>
	);
}

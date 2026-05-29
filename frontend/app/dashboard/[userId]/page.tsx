import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';
import { redirect } from 'next/navigation';

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function UserDashboardPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  if (!userId || !isUuidV4(userId)) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <DashboardShell userId={userId} focus="home" />

      <AppBottomNav userId={userId} role="customer" />
    </main>
  );
}

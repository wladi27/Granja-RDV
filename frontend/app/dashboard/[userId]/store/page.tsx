import { StorePage } from '@/components/store/store-page';

export default async function DashboardStorePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return <StorePage dashboardMode dashboardUserId={userId} />;
}
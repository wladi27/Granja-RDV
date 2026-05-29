import { CourierDeliveredOrdersPanel } from '@/components/courier/courier-delivered-orders-panel';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function CourierDeliveredPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <CourierDeliveredOrdersPanel />

      <AppBottomNav role="courier" />
    </main>
  );
}
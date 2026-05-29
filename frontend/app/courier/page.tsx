import { CourierRouteBoard } from '@/components/courier/courier-route-board';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function CourierPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <CourierRouteBoard />

      <AppBottomNav role="courier" />
    </main>
  );
}

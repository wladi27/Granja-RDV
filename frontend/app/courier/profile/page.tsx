import { CourierProfileSection } from '@/components/courier/courier-profile-section';
import { AppBottomNav } from '@/components/layout/app-bottom-nav';

export default function CourierProfilePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pt-6">
      <CourierProfileSection />

      <AppBottomNav role="courier" />
    </main>
  );
}

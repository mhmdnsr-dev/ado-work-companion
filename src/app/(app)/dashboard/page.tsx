import type { Metadata } from 'next';

import { DashboardView } from '@/features/dashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Connection overview, quick actions, and favorites for organizing work.',
};

export default function DashboardPage() {
  return <DashboardView />;
}

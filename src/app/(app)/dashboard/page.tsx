import type { Metadata } from 'next';

import { DashboardView } from '@/features/dashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Azure DevOps connection overview, recent requests, and favorites.',
};

export default function DashboardPage() {
  return <DashboardView />;
}

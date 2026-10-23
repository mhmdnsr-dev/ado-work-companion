'use client';

import dynamic from 'next/dynamic';

import { DashboardFavorites } from '@/features/dashboard/favorites-panel';
import { Skeleton } from '@/components/ui/skeleton';

const SprintBurndownPanel = dynamic(
  () =>
    import('@/features/dashboard/sprint-burndown-panel').then((mod) => ({
      default: mod.SprintBurndownPanel,
    })),
  {
    loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
    ssr: false,
  },
);

export function DashboardView() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <header className="hidden space-y-1 md:block">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Your sprint at a glance, and the work to update today.
        </p>
      </header>

      <SprintBurndownPanel />

      {/* Page shortcuts repeat the bottom nav on phones, so they're desktop only. */}
      <div className="hidden md:block">
        <DashboardFavorites />
      </div>
    </div>
  );
}

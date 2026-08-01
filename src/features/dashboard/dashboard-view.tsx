'use client';

import dynamic from 'next/dynamic';

import { DashboardFavorites } from '@/features/dashboard/favorites-panel';
import { DashboardQuickActions } from '@/features/dashboard/quick-actions';
import { DashboardStatusCards } from '@/features/dashboard/status-cards';
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
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          See where you are connected and jump straight into organizing work.
        </p>
      </header>

      <DashboardStatusCards />

      <SprintBurndownPanel />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <DashboardQuickActions />
        <DashboardFavorites />
      </div>
    </div>
  );
}

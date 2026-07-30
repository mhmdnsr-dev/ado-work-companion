'use client';

import { DashboardFavorites } from '@/features/dashboard/favorites-panel';
import { DashboardRecentRequests } from '@/features/dashboard/recent-requests';
import { DashboardStatusCards } from '@/features/dashboard/status-cards';

export function DashboardView() {
  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Overview of your Azure DevOps connection, recent API activity, and favorite
          tools.
        </p>
      </header>

      <DashboardStatusCards />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <DashboardRecentRequests />
        <DashboardFavorites />
      </div>
    </div>
  );
}

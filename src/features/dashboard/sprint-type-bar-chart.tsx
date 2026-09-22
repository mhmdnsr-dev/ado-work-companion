'use client';

import type { MemberSprintStatsModel } from '@core/domain';
import { cn } from '@/lib/utils';

export function SprintTypeBarChart({
  stats,
  className,
}: {
  stats: MemberSprintStatsModel;
  className?: string;
}) {
  const max = Math.max(1, ...stats.tasksByType.map((row) => row.count));

  if (stats.tasksByType.length === 0) {
    return (
      <div className={cn('min-h-24', className)}>
        <p className="text-sm text-muted-foreground">
          No assigned work items in this sprint.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2.5', className)} role="img" aria-label="Items by type">
      {stats.tasksByType.map((row) => (
        <div key={row.type} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground" title={row.type}>
              {row.type}
            </span>
            <span className="shrink-0 font-medium text-foreground tabular-nums">
              {row.count}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

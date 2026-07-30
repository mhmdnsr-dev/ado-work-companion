'use client';

import type { SprintSnapshotModel } from '@core/domain';
import { cn } from '@/lib/utils';

function MetricBarRows({
  rows,
  emptyLabel,
  className,
  ariaLabel,
}: {
  rows: Array<{ label: string; value: number; display?: string }>;
  emptyLabel: string;
  className?: string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return (
      <div className={cn('min-h-24', className)}>
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2.5', className)} role="img" aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {row.display ?? row.value}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SprintStateBarChart({
  snapshot,
  className,
}: {
  snapshot: SprintSnapshotModel;
  className?: string;
}) {
  return (
    <MetricBarRows
      className={className}
      ariaLabel="Items by state"
      emptyLabel="No items in this sprint yet."
      rows={snapshot.tasksByState.map((row) => ({
        label: row.state,
        value: row.count,
      }))}
    />
  );
}

export function SprintHoursProgressChart({
  snapshot,
  className,
}: {
  snapshot: SprintSnapshotModel;
  className?: string;
}) {
  return (
    <MetricBarRows
      className={className}
      ariaLabel="Hours progress"
      emptyLabel="No hours recorded yet."
      rows={[
        {
          label: 'Completed',
          value: snapshot.completedHours,
          display: `${snapshot.completedHours} h`,
        },
        {
          label: 'Remaining',
          value: snapshot.remainingHours,
          display: `${snapshot.remainingHours} h`,
        },
      ]}
    />
  );
}

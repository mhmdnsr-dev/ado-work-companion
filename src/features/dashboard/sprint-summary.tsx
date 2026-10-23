'use client';

import { formatHours } from '@/features/work-items/work-item-visuals';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

/**
 * The one number the dashboard leads with (remaining hours), the sprint's time
 * as a meter, and a 2×2 row of supporting figures.
 */
export function SprintSummary({
  scopeLabel,
  remainingHours,
  completedHours,
  completedPercent,
  openCount,
  closedCount,
  daysElapsed,
  daysRemaining,
}: {
  scopeLabel: string;
  remainingHours: number;
  completedHours: number;
  completedPercent: number;
  openCount: number;
  closedCount: number;
  daysElapsed: number;
  daysRemaining: number;
}) {
  // Both ends count: Oct 13 → Oct 26 is 14 days, so Oct 23 is "day 11 of 14".
  const totalDays = daysElapsed + daysRemaining + 1;
  const today = daysElapsed + 1;
  const elapsed = Math.min(1, today / totalDays);

  return (
    <section aria-labelledby="sprint-summary-heading" className="space-y-4">
      <div>
        <h2 id="sprint-summary-heading" className="text-xs text-muted-foreground">
          {scopeLabel}
        </h2>
        <p className="mt-1 text-5xl leading-none font-semibold tracking-tight">
          {formatHours(remainingHours)}
          <span className="ms-1 text-2xl font-medium text-muted-foreground">h</span>
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">
            Day {today} of {totalDays}
          </span>
          <span className="font-medium text-foreground">
            {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left
          </span>
        </div>
        {/* Meter: track is a lighter step of the fill's own hue. */}
        <div
          role="meter"
          aria-label="Sprint time elapsed"
          aria-valuemin={0}
          aria-valuemax={totalDays}
          aria-valuenow={today}
          aria-valuetext={`Day ${today} of ${totalDays}, ${daysRemaining} days left`}
          className="h-2 overflow-hidden rounded-full bg-primary/15"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${elapsed * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Done" value={`${completedPercent}%`} />
        <StatTile label="Completed" value={`${formatHours(completedHours)}h`} />
        <StatTile label="Open items" value={String(openCount)} />
        <StatTile label="Closed items" value={String(closedCount)} />
      </div>
    </section>
  );
}

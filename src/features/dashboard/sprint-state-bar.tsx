'use client';

import { useState } from 'react';

import type { SprintProgressCategory, SprintStateSlice } from '@core/domain';
import { cn } from '@/lib/utils';

const LABELS: Record<SprintProgressCategory, string> = {
  proposed: 'Not started',
  inProgress: 'In progress',
  resolved: 'Resolved',
  completed: 'Done',
};

/** Ordinal ramp (early → done), validated light and dark with dataviz --ordinal. */
const FILL: Record<SprintProgressCategory, string> = {
  proposed: 'bg-progress-proposed',
  inProgress: 'bg-progress-in-progress',
  resolved: 'bg-progress-resolved',
  completed: 'bg-progress-completed',
};

/**
 * Part-to-whole as one stacked bar: 2px surface gaps between segments, rounded
 * outer ends, and a legend that carries the counts (identity is never color alone).
 */
export function SprintStateBar({ slices }: { slices: SprintStateSlice[] }) {
  const [active, setActive] = useState<SprintProgressCategory | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No items in this sprint yet.</p>;
  }
  const activeSlice = slices.find((slice) => slice.category === active);

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {activeSlice
          ? `${LABELS[activeSlice.category]}: ${activeSlice.count} of ${total} (${Math.round(
              (activeSlice.count / total) * 100,
            )}%)`
          : `${total} item${total === 1 ? '' : 's'}`}
      </p>
      <div
        role="img"
        aria-label={slices
          .map((slice) => `${LABELS[slice.category]} ${slice.count}`)
          .join(', ')}
        className="flex h-3 gap-[2px]"
      >
        {slices.map((slice) => (
          <span
            key={slice.category}
            onPointerEnter={() => setActive(slice.category)}
            onPointerLeave={() => setActive(null)}
            className={cn(
              'h-full min-w-1 transition-opacity first:rounded-s-[4px] last:rounded-e-[4px]',
              FILL[slice.category],
              active && active !== slice.category && 'opacity-50',
            )}
            style={{ flexGrow: slice.count, flexBasis: 0 }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {slices.map((slice) => (
          <li key={slice.category} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn('size-2.5 shrink-0 rounded-[2px]', FILL[slice.category])}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {LABELS[slice.category]}
            </span>
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {slice.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

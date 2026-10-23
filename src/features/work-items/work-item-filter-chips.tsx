'use client';

import { X } from 'lucide-react';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Active filters as removable chips. Scrolls sideways on phones rather than
 * wrapping into a tall block above the list.
 */
export function WorkItemFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <ul
      aria-label="Active filters"
      className="-mx-4 flex scrollbar-none gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:px-0"
    >
      {chips.map((chip) => (
        <li key={chip.key} className="shrink-0">
          {/* The ::before extends the hit area to 44px without a taller chip. */}
          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.onRemove}
            className="relative flex h-9 max-w-64 items-center gap-1.5 rounded-full border border-border bg-secondary/60 ps-3 pe-2 text-xs font-medium text-secondary-foreground transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-secondary"
          >
            <span className="truncate">{chip.label}</span>
            <X className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
      {chips.length > 1 ? (
        <li className="shrink-0">
          <button
            type="button"
            onClick={onClearAll}
            className="relative h-9 px-2 text-xs font-semibold text-primary before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:underline"
          >
            Clear all
          </button>
        </li>
      ) : null}
    </ul>
  );
}

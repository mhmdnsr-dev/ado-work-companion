'use client';

import type { WorkItemFiltersState, WorkItemScope } from '@core/domain';
import { cn } from '@/lib/utils';

interface QuickView {
  id: string;
  label: string;
  scope: WorkItemScope;
  /** `''` means anyone. */
  assignedTo: string;
}

/** The Azure DevOps "Work Items" hub pivots, as one-tap presets. */
const QUICK_VIEWS: QuickView[] = [
  { id: 'mine', label: 'Assigned to me', scope: 'all', assignedTo: '@Me' },
  { id: 'following', label: 'Following', scope: 'following', assignedTo: '' },
  { id: 'mentioned', label: 'Mentioned', scope: 'mentioned', assignedTo: '' },
  { id: 'activity', label: 'My activity', scope: 'activity', assignedTo: '' },
];

export function WorkItemQuickViews({
  filters,
  onSelect,
}: {
  filters: Pick<WorkItemFiltersState, 'scope' | 'assignedTo'>;
  onSelect: (patch: Pick<WorkItemFiltersState, 'scope' | 'assignedTo'>) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Quick views"
      className="-mx-4 flex scrollbar-none gap-5 overflow-x-auto border-b border-border [mask-image:linear-gradient(to_right,black_85%,transparent)] px-4 md:mx-0 md:[mask-image:none] md:px-0"
    >
      {QUICK_VIEWS.map((view) => {
        const active =
          filters.scope === view.scope &&
          (view.scope !== 'all' || filters.assignedTo === view.assignedTo);
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect({ scope: view.scope, assignedTo: view.assignedTo })}
            className={cn(
              '-mb-px flex h-11 shrink-0 items-center border-b-2 text-sm whitespace-nowrap transition-colors',
              active
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

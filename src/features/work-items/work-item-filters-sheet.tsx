'use client';

import { RotateCcw, Save, X } from 'lucide-react';

import type { WorkItemFiltersState } from '@core/domain';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useMediaQuery } from '@/hooks';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  description?: string;
}

function isSpecificPerson(assignedTo: string): boolean {
  return Boolean(assignedTo) && assignedTo !== '@Me' && assignedTo !== '__unassigned__';
}

export type WorkItemFiltersPatch = Partial<
  Omit<WorkItemFiltersState, 'organization' | 'project'>
>;

/**
 * All work item filters in one sheet: a bottom sheet on phones (thumb reach,
 * full width) and a side sheet from `md` up. Filters apply as they change.
 */
export function WorkItemFiltersSheet({
  open,
  onOpenChange,
  project,
  filters,
  onChange,
  typeOptions,
  teamOptions,
  sprintOptions,
  assigneeOptions,
  typesLoading,
  sprintsLoading,
  peopleLoading,
  showPeopleHint,
  onReset,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: string;
  filters: WorkItemFiltersState;
  onChange: (patch: WorkItemFiltersPatch) => void;
  typeOptions: FilterOption[];
  teamOptions: FilterOption[];
  sprintOptions: FilterOption[];
  assigneeOptions: FilterOption[];
  typesLoading: boolean;
  sprintsLoading: boolean;
  peopleLoading: boolean;
  showPeopleHint: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const side = desktop ? 'right' : 'bottom';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn(
          'gap-0 p-0',
          side === 'bottom'
            ? 'mobile-safe-bottom max-h-[88dvh] rounded-t-2xl'
            : 'w-full sm:max-w-md',
        )}
      >
        {side === 'bottom' ? (
          <span
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border"
          />
        ) : null}
        <SheetHeader className="flex-row items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="space-y-0.5">
            <SheetTitle className="text-base">Filters</SheetTitle>
            <SheetDescription className="text-xs">
              Narrow work items in {project}. Changes apply right away.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="touch-target -me-2 -mt-1 shrink-0"
              aria-label="Close filters"
            >
              <X className="size-5" />
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <SearchableSelect
              value={filters.typeFilter === 'all' ? '' : filters.typeFilter}
              onChange={(value) => onChange({ typeFilter: value || 'all' })}
              options={typeOptions}
              placeholder="All types"
              searchPlaceholder="Search types…"
              allowClear
              clearLabel="All types"
              disabled={typesLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-items-state">Status</Label>
            <Select
              value={filters.stateFilter}
              onValueChange={(value) =>
                onChange({ stateFilter: value as WorkItemFiltersState['stateFilter'] })
              }
            >
              <SelectTrigger id="work-items-state" className="touch-target h-11 w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Done / closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <SearchableSelect
              value={filters.teamId}
              onChange={(value) =>
                onChange({
                  teamId: value,
                  sprintPath: '',
                  // People are listed per team, so a specific person may not apply.
                  ...(isSpecificPerson(filters.assignedTo) ? { assignedTo: '@Me' } : {}),
                })
              }
              options={teamOptions}
              placeholder="All teams"
              searchPlaceholder="Search teams…"
              allowClear
              clearLabel="All teams"
            />
          </div>

          <div className="space-y-2">
            <Label>Sprint</Label>
            <SearchableSelect
              value={filters.sprintPath}
              onChange={(value) => onChange({ sprintPath: value })}
              options={sprintOptions}
              placeholder="All sprints"
              searchPlaceholder="Search sprints…"
              allowClear
              clearLabel="All sprints"
              disabled={sprintsLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Assigned to</Label>
            <SearchableSelect
              value={filters.assignedTo}
              onChange={(value) => onChange({ assignedTo: value })}
              options={assigneeOptions}
              placeholder="Anyone"
              searchPlaceholder="Search people…"
              allowClear
              clearLabel="Anyone"
              disabled={peopleLoading}
            />
            {showPeopleHint ? (
              <p className="text-xs text-muted-foreground">
                People load from project teams when available.
              </p>
            ) : null}
          </div>

          {filters.displayMode === 'hierarchy' ? (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <Label htmlFor="work-items-include-children" className="font-normal">
                Include child tasks/bugs
              </Label>
              <Switch
                id="work-items-include-children"
                checked={filters.includeChildren}
                onCheckedChange={(checked) => onChange({ includeChildren: checked })}
              />
            </div>
          ) : null}
        </div>

        <SheetFooter className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            className="touch-target h-11 gap-2"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
            Reset filters
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11 gap-2"
            onClick={onSave}
          >
            <Save className="size-4" />
            Save filters
          </Button>
          <SheetClose asChild>
            <Button type="button" className="touch-target col-span-2 h-11">
              Show work items
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

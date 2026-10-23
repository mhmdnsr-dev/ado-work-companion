import type { WorkItem } from '../types/work-items';
import { fieldNumber, fieldString } from './work-items';
import {
  getWorkItemChildIds,
  workItemStateCategory,
  type WorkItemStateCategory,
  type WorkItemStateLookup,
} from './work-item-hierarchy';

/** Progress order, early to done. Removed items are left out of the sprint view. */
export const SPRINT_PROGRESS_ORDER = [
  'proposed',
  'inProgress',
  'resolved',
  'completed',
] as const satisfies readonly WorkItemStateCategory[];

export type SprintProgressCategory = (typeof SPRINT_PROGRESS_ORDER)[number];

export interface SprintStateSlice {
  category: SprintProgressCategory;
  count: number;
}

/**
 * Counted work (leaf, not removed) per progress category, in fixed order,
 * skipping empty categories.
 */
export function buildSprintStateBreakdown(
  items: WorkItem[],
  lookup?: WorkItemStateLookup,
): SprintStateSlice[] {
  const counts = new Map<SprintProgressCategory, number>();
  for (const item of items) {
    if (!isLeafWork(item)) continue;
    const category = workItemStateCategory(item, lookup);
    if (category === 'removed') continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return SPRINT_PROGRESS_ORDER.filter((category) => (counts.get(category) ?? 0) > 0).map(
    (category) => ({ category, count: counts.get(category)! }),
  );
}

/**
 * Leaf work (no child links) is what people update day to day. Type names and
 * hour fields can't tell this reliably: processes add custom types, and some
 * put Remaining Work on stories. Needs items loaded with relations.
 */
export function isLeafWork(item: WorkItem): boolean {
  return getWorkItemChildIds(item).length === 0;
}

/** Leaf, not removed: the set every dashboard number is computed over. */
export function isCountedSprintWork(
  item: WorkItem,
  lookup?: WorkItemStateLookup,
): boolean {
  return isLeafWork(item) && workItemStateCategory(item, lookup) !== 'removed';
}

export function isSprintWorkDone(item: WorkItem, lookup?: WorkItemStateLookup): boolean {
  return workItemStateCategory(item, lookup) === 'completed';
}

export interface SprintWorkSummary {
  remainingHours: number;
  completedHours: number;
  openCount: number;
  closedCount: number;
}

/**
 * Hours and counts over counted sprint work, so the hero figure, the tiles,
 * the burndown end, and the open-work list all agree.
 */
export function summarizeSprintWork(
  items: WorkItem[],
  lookup?: WorkItemStateLookup,
): SprintWorkSummary {
  const summary: SprintWorkSummary = {
    remainingHours: 0,
    completedHours: 0,
    openCount: 0,
    closedCount: 0,
  };
  for (const item of items) {
    if (!isCountedSprintWork(item, lookup)) continue;
    summary.completedHours +=
      fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork') ?? 0;
    if (isSprintWorkDone(item, lookup)) {
      summary.closedCount += 1;
    } else {
      summary.openCount += 1;
      summary.remainingHours +=
        fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork') ?? 0;
    }
  }
  summary.remainingHours = Math.round(summary.remainingHours * 100) / 100;
  summary.completedHours = Math.round(summary.completedHours * 100) / 100;
  return summary;
}

const OPEN_ORDER: Record<WorkItemStateCategory, number> = {
  inProgress: 0,
  resolved: 1,
  proposed: 2,
  completed: 3,
  removed: 4,
};

/**
 * The "Today" list: open leaf sprint work, in progress first, then the most
 * recently changed.
 */
export function selectOpenSprintWork(
  items: WorkItem[],
  lookup?: WorkItemStateLookup,
): WorkItem[] {
  return items
    .filter((item) => {
      const category = workItemStateCategory(item, lookup);
      return category !== 'completed' && category !== 'removed' && isLeafWork(item);
    })
    .sort((a, b) => {
      const byState =
        OPEN_ORDER[workItemStateCategory(a, lookup)] -
        OPEN_ORDER[workItemStateCategory(b, lookup)];
      if (byState !== 0) return byState;
      return fieldString(b, 'System.ChangedDate').localeCompare(
        fieldString(a, 'System.ChangedDate'),
      );
    });
}

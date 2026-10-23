import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../types/work-items';
import {
  buildSprintStateBreakdown,
  isCountedSprintWork,
  isSprintWorkDone,
  selectOpenSprintWork,
  summarizeSprintWork,
} from './sprint-dashboard';
import { buildSprintBurndownFromWorkItems } from './sprint-burndown';
import { buildWorkItemStateLookup } from './work-item-hierarchy';

function item(
  id: number,
  type: string,
  state: string,
  options: {
    changed?: string;
    children?: number[];
    remaining?: number;
    completed?: number;
  } = {},
): WorkItem {
  return {
    id,
    fields: {
      'System.WorkItemType': type,
      'System.State': state,
      'System.ChangedDate': options.changed ?? '2026-10-01T00:00:00Z',
      'Microsoft.VSTS.Scheduling.RemainingWork': options.remaining ?? 0,
      'Microsoft.VSTS.Scheduling.CompletedWork': options.completed ?? 0,
    },
    relations: (options.children ?? []).map((child) => ({
      rel: 'System.LinkTypes.Hierarchy-Forward',
      url: `https://dev.azure.com/contoso/_apis/wit/workItems/${child}`,
    })),
  };
}

describe('sprint dashboard helpers', () => {
  it('counts items per progress category in fixed order and skips removed', () => {
    const items = [
      item(1, 'Task', 'Closed'),
      item(2, 'Task', 'Active'),
      item(3, 'Task', 'New'),
      item(4, 'Task', 'Active'),
      item(5, 'Task', 'Removed'),
    ];
    expect(buildSprintStateBreakdown(items)).toEqual([
      { category: 'proposed', count: 1 },
      { category: 'inProgress', count: 2 },
      { category: 'completed', count: 1 },
    ]);
  });

  it('uses process categories for custom states', () => {
    const lookup = buildWorkItemStateLookup([
      { name: 'Task', states: [{ name: 'Review', category: 'InProgress' }] },
    ]);
    expect(buildSprintStateBreakdown([item(1, 'Task', 'Review')], lookup)).toEqual([
      { category: 'inProgress', count: 1 },
    ]);
  });

  it('lists open leaf work, in progress first, then most recent', () => {
    const items = [
      item(1, 'Task', 'New', { changed: '2026-10-05T00:00:00Z' }),
      item(2, 'Task', 'Active', { changed: '2026-10-02T00:00:00Z' }),
      item(3, 'Bug', 'Active', { changed: '2026-10-04T00:00:00Z' }),
      item(4, 'Task', 'Closed'),
      // A story with tasks is a container, not work to update.
      item(5, 'User Story', 'Active', { children: [2] }),
      // Custom types and childless stories still count.
      item(6, 'Meetings', 'New', { changed: '2026-10-06T00:00:00Z' }),
      item(7, 'User Story', 'New', { changed: '2026-10-03T00:00:00Z' }),
    ];
    expect(selectOpenSprintWork(items).map((entry) => entry.id)).toEqual([3, 2, 6, 1, 7]);
  });

  it('summarizes leaf work so every number agrees with the burndown', () => {
    const items = [
      item(1, 'Task', 'Active', { remaining: 4, completed: 1 }),
      item(2, 'Bug', 'New', { remaining: 2 }),
      item(3, 'Task', 'Closed', { completed: 3 }),
      // Containers and removed items never count.
      item(4, 'User Story', 'Active', { children: [1], remaining: 8 }),
      item(5, 'Task', 'Removed', { remaining: 5 }),
    ];
    const summary = summarizeSprintWork(items);
    expect(summary).toEqual({
      remainingHours: 6,
      completedHours: 4,
      openCount: 2,
      closedCount: 1,
    });

    const model = buildSprintBurndownFromWorkItems({
      items,
      sprintStart: '2026-10-01',
      sprintEnd: '2026-10-10',
      asOf: '2026-10-05',
      include: (entry) => isCountedSprintWork(entry),
      isCompleted: (entry) => isSprintWorkDone(entry),
    });
    expect(model.metrics.remainingWork).toBe(summary.remainingHours);
  });
});

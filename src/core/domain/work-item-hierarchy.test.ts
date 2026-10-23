import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../types/work-items';
import {
  buildWorkItemHierarchy,
  collectHierarchyParentIds,
  flattenVisibleHierarchy,
  getWorkItemChildIds,
  getWorkItemParentId,
  isClosedWorkItemState,
  summarizeHierarchyNode,
  workItemStateCategory,
} from './work-item-hierarchy';

function item(
  id: number,
  options: {
    parent?: number;
    children?: number[];
    state?: string;
    changed?: string;
    remaining?: number;
  } = {},
): WorkItem {
  const relations = [];
  if (options.parent != null) {
    relations.push({
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: `https://dev.azure.com/contoso/_apis/wit/workItems/${options.parent}`,
    });
  }
  for (const child of options.children ?? []) {
    relations.push({
      rel: 'System.LinkTypes.Hierarchy-Forward',
      url: `https://dev.azure.com/contoso/_apis/wit/workItems/${child}`,
    });
  }
  return {
    id,
    fields: {
      'System.State': options.state ?? 'New',
      'System.ChangedDate': options.changed ?? '2026-01-01T00:00:00Z',
      ...(options.remaining != null
        ? { 'Microsoft.VSTS.Scheduling.RemainingWork': options.remaining }
        : {}),
    },
    relations,
  };
}

describe('work item hierarchy helpers', () => {
  it('reads parent and child ids from relations', () => {
    const story = item(10, { parent: 1, children: [20, 21] });
    expect(getWorkItemParentId(story)).toBe(1);
    expect(getWorkItemChildIds(story)).toEqual([20, 21]);
  });

  it('nests children under their parent and keeps orphans as roots', () => {
    const tree = buildWorkItemHierarchy([
      item(10),
      item(20, { parent: 10 }),
      item(30, { parent: 10 }),
      item(40),
    ]);

    expect(tree.roots.map((node) => node.item.id)).toEqual([10, 40]);
    const story = tree.nodes.get(10);
    expect(story?.children.map((node) => node.item.id)).toEqual([20, 30]);
  });

  it('promotes a child to a root when its parent is not loaded', () => {
    const tree = buildWorkItemHierarchy([item(20, { parent: 10 })]);
    expect(tree.roots.map((node) => node.item.id)).toEqual([20]);
    expect(tree.roots[0]?.children).toEqual([]);
  });

  it('does not lose items when relations form a cycle', () => {
    const tree = buildWorkItemHierarchy([
      item(10, { parent: 20 }),
      item(20, { parent: 10 }),
    ]);

    const flattened: number[] = [];
    const visit = (nodes: typeof tree.roots) => {
      for (const node of nodes) {
        flattened.push(node.item.id!);
        visit(node.children);
      }
    };
    visit(tree.roots);

    expect(flattened.sort()).toEqual([10, 20]);
  });

  it('sorts siblings by changed date and priority', () => {
    const tree = buildWorkItemHierarchy([
      item(1),
      item(2, { parent: 1, changed: '2026-01-02T00:00:00Z' }),
      item(3, { parent: 1, changed: '2026-01-03T00:00:00Z' }),
    ]);

    expect(tree.nodes.get(1)?.children.map((node) => node.item.id)).toEqual([3, 2]);
  });

  it('recognizes closed states', () => {
    expect(isClosedWorkItemState(item(1, { state: 'Closed' }))).toBe(true);
    expect(isClosedWorkItemState(item(2, { state: 'Done' }))).toBe(true);
    expect(isClosedWorkItemState(item(3, { state: 'Removed' }))).toBe(true);
    expect(isClosedWorkItemState(item(4, { state: 'Active' }))).toBe(false);
  });

  it('maps process states to categories and treats custom states as proposed', () => {
    expect(workItemStateCategory(item(1, { state: 'To Do' }))).toBe('proposed');
    expect(workItemStateCategory(item(2, { state: 'In Progress' }))).toBe('inProgress');
    expect(workItemStateCategory(item(3, { state: 'Resolved' }))).toBe('resolved');
    expect(workItemStateCategory(item(4, { state: 'Closed' }))).toBe('completed');
    expect(workItemStateCategory(item(5, { state: 'Removed' }))).toBe('removed');
    expect(workItemStateCategory(item(6, { state: 'Waiting on vendor' }))).toBe(
      'proposed',
    );
  });

  it('rolls up leaf progress and remaining hours across nested levels', () => {
    const tree = buildWorkItemHierarchy([
      item(1),
      item(2, { parent: 1 }),
      item(3, { parent: 2, state: 'Done', remaining: 0 }),
      item(4, { parent: 2, state: 'Active', remaining: 4 }),
      item(5, { parent: 1, state: 'Resolved', remaining: 1.5 }),
    ]);

    expect(summarizeHierarchyNode(tree.nodes.get(1)!)).toEqual({
      total: 3,
      completed: 2,
      remainingHours: 5.5,
    });
    expect(summarizeHierarchyNode(tree.nodes.get(4)!)).toEqual({
      total: 0,
      completed: 0,
      remainingHours: 0,
    });
  });

  it('flattens only visible rows with tree positions', () => {
    const tree = buildWorkItemHierarchy([
      item(1, { changed: '2026-01-05T00:00:00Z' }),
      item(2, { parent: 1, changed: '2026-01-04T00:00:00Z' }),
      item(3, { parent: 2 }),
      item(4, { parent: 1, changed: '2026-01-03T00:00:00Z' }),
      item(5, { changed: '2026-01-02T00:00:00Z' }),
    ]);

    const expanded = flattenVisibleHierarchy(tree.roots, new Set());
    expect(expanded.map((row) => [row.id, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 1],
      [5, 0],
    ]);
    const nested = expanded[2]!;
    expect(nested.parentId).toBe(2);
    expect(nested.ancestorIsLast).toEqual([false, false]);
    expect(expanded[3]).toMatchObject({ posInSet: 2, setSize: 2, isLast: true });

    const collapsed = flattenVisibleHierarchy(tree.roots, new Set([2]));
    expect(collapsed.map((row) => row.id)).toEqual([1, 2, 4, 5]);
    expect(collapsed[1]).toMatchObject({ hasChildren: true, expanded: false });
  });

  it('collects every parent id for collapse all', () => {
    const tree = buildWorkItemHierarchy([
      item(1),
      item(2, { parent: 1 }),
      item(3, { parent: 2 }),
      item(4),
    ]);
    expect(collectHierarchyParentIds(tree.roots).sort()).toEqual([1, 2]);
  });
});

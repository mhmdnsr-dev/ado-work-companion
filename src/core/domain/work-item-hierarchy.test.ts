import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../types/work-items';
import {
  buildWorkItemHierarchy,
  getWorkItemChildIds,
  getWorkItemParentId,
  isClosedWorkItemState,
} from './work-item-hierarchy';

function item(
  id: number,
  options: {
    parent?: number;
    children?: number[];
    state?: string;
    changed?: string;
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
});

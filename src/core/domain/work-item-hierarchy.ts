import type { WorkItem } from '../types/work-items';
import { fieldNumber, fieldString, parseWorkItemIdFromRelationUrl } from './work-items';

/** Parent relation points from a child to its parent. */
export const HIERARCHY_PARENT_REL = 'System.LinkTypes.Hierarchy-Reverse';
/** Child relation points from a parent to each direct child. */
export const HIERARCHY_CHILD_REL = 'System.LinkTypes.Hierarchy-Forward';

/** Image/attachment relations are already ignored by the hierarchy helpers. */
function relationIds(item: WorkItem, rel: string): number[] {
  return (item.relations ?? [])
    .filter((relation) => relation.rel === rel)
    .map((relation) => parseWorkItemIdFromRelationUrl(relation.url))
    .filter((id): id is number => id != null);
}

export function getWorkItemParentId(item: WorkItem): number | null {
  const [parentId] = relationIds(item, HIERARCHY_PARENT_REL);
  return parentId ?? null;
}

export function getWorkItemChildIds(item: WorkItem): number[] {
  return [...new Set(relationIds(item, HIERARCHY_CHILD_REL))];
}

export interface WorkItemHierarchyNode {
  item: WorkItem;
  children: WorkItemHierarchyNode[];
}

function sortWorkItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    const changed = fieldString(b, 'System.ChangedDate').localeCompare(
      fieldString(a, 'System.ChangedDate'),
    );
    if (changed !== 0) return changed;

    const aPriority =
      fieldNumber(a, 'Microsoft.VSTS.Common.Priority') ?? Number.MAX_VALUE;
    const bPriority =
      fieldNumber(b, 'Microsoft.VSTS.Common.Priority') ?? Number.MAX_VALUE;
    if (aPriority !== bPriority) return aPriority - bPriority;

    return (a.id ?? 0) - (b.id ?? 0);
  });
}

/**
 * Groups work items into an expandable parent/child tree using ADO hierarchy
 * relations. Missing parents, duplicate links, and accidental cycles are
 * tolerated so a malformed link can never hide items from the list.
 */
export function buildWorkItemHierarchy(items: WorkItem[]): {
  roots: WorkItemHierarchyNode[];
  nodes: Map<number, WorkItemHierarchyNode>;
} {
  const itemsById = new Map<number, WorkItem>();
  for (const item of items) {
    if (item.id != null && !itemsById.has(item.id)) itemsById.set(item.id, item);
  }

  const parentById = new Map<number, number>();
  for (const [id, item] of itemsById) {
    const parentId = getWorkItemParentId(item);
    if (parentId != null && parentId !== id && itemsById.has(parentId)) {
      parentById.set(id, parentId);
    }
  }

  // Break cycles by dropping the edge that closes the loop. A cycle would
  // otherwise leave nodes unreachable from any root.
  for (const id of itemsById.keys()) {
    const seen = new Set<number>();
    let current = parentById.get(id);
    while (current != null) {
      if (current === id || seen.has(current)) {
        parentById.delete(id);
        break;
      }
      seen.add(current);
      current = parentById.get(current);
    }
  }

  const nodes = new Map<number, WorkItemHierarchyNode>();
  for (const [id, item] of itemsById) {
    nodes.set(id, { item, children: [] });
  }

  const roots: WorkItemHierarchyNode[] = [];
  for (const [id, node] of nodes) {
    const parentId = parentById.get(id);
    const parent = parentId != null ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const node of nodes.values()) {
    if (node.children.length > 1) {
      const sorted = sortWorkItems(node.children.map((child) => child.item));
      const byId = new Map(node.children.map((child) => [child.item.id, child]));
      node.children = sorted
        .map((item) => byId.get(item.id))
        .filter((child): child is WorkItemHierarchyNode => child != null);
    }
  }

  const sortedRoots = sortWorkItems(roots.map((root) => root.item))
    .map((item) => nodes.get(item.id!) ?? null)
    .filter((node): node is WorkItemHierarchyNode => node != null);

  return { roots: sortedRoots, nodes };
}

/** True when the state counts as done, closed, or removed. */
export function isClosedWorkItemState(item: WorkItem): boolean {
  const state = fieldString(item, 'System.State').toLowerCase();
  return state === 'closed' || state === 'done' || state === 'removed';
}

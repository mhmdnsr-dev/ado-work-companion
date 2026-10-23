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

/** Azure DevOps state categories, used for the state dot colour. */
export type WorkItemStateCategory =
  'proposed' | 'inProgress' | 'resolved' | 'completed' | 'removed';

/**
 * Default states of the Agile, Scrum, Basic, and CMMI processes. Custom states
 * fall back to "proposed" so an unknown state never looks finished.
 */
const STATE_CATEGORIES: Record<string, WorkItemStateCategory> = {
  new: 'proposed',
  proposed: 'proposed',
  'to do': 'proposed',
  approved: 'proposed',
  active: 'inProgress',
  committed: 'inProgress',
  'in progress': 'inProgress',
  doing: 'inProgress',
  resolved: 'resolved',
  closed: 'completed',
  done: 'completed',
  removed: 'removed',
};

export function workItemStateCategory(item: WorkItem): WorkItemStateCategory {
  const state = fieldString(item, 'System.State').trim().toLowerCase();
  return STATE_CATEGORIES[state] ?? 'proposed';
}

export interface WorkItemHierarchySummary {
  /** Loaded leaf descendants (tasks, bugs, …) under the node. */
  total: number;
  /** Leaves in a resolved or completed state. */
  completed: number;
  /** Sum of Remaining Work across the leaves. */
  remainingHours: number;
}

/** Rolls up progress for a parent row from its loaded leaf descendants. */
export function summarizeHierarchyNode(
  node: WorkItemHierarchyNode,
): WorkItemHierarchySummary {
  const summary: WorkItemHierarchySummary = { total: 0, completed: 0, remainingHours: 0 };
  const visit = (current: WorkItemHierarchyNode) => {
    for (const child of current.children) {
      if (child.children.length > 0) {
        visit(child);
        continue;
      }
      summary.total += 1;
      const category = workItemStateCategory(child.item);
      if (category === 'completed' || category === 'resolved') summary.completed += 1;
      summary.remainingHours +=
        fieldNumber(child.item, 'Microsoft.VSTS.Scheduling.RemainingWork') ?? 0;
    }
  };
  visit(node);
  return summary;
}

export interface VisibleHierarchyRow {
  node: WorkItemHierarchyNode;
  id: number | null;
  /** 0 for roots. */
  depth: number;
  parentId: number | null;
  hasChildren: boolean;
  expanded: boolean;
  /** 1-based position among siblings, for aria-posinset. */
  posInSet: number;
  setSize: number;
  isLast: boolean;
  /** `ancestorIsLast[d]` is true when the ancestor at depth `d` is a last sibling. */
  ancestorIsLast: boolean[];
}

/** Flattens the tree into the rows currently visible given the collapsed ids. */
export function flattenVisibleHierarchy(
  roots: WorkItemHierarchyNode[],
  collapsedIds: ReadonlySet<number>,
): VisibleHierarchyRow[] {
  const rows: VisibleHierarchyRow[] = [];
  const visit = (
    nodes: WorkItemHierarchyNode[],
    depth: number,
    parentId: number | null,
    ancestorIsLast: boolean[],
  ) => {
    nodes.forEach((node, index) => {
      const id = node.item.id ?? null;
      const hasChildren = node.children.length > 0;
      const expanded = hasChildren && (id == null || !collapsedIds.has(id));
      const isLast = index === nodes.length - 1;
      rows.push({
        node,
        id,
        depth,
        parentId,
        hasChildren,
        expanded,
        posInSet: index + 1,
        setSize: nodes.length,
        isLast,
        ancestorIsLast,
      });
      if (expanded) visit(node.children, depth + 1, id, [...ancestorIsLast, isLast]);
    });
  };
  visit(roots, 0, null, []);
  return rows;
}

/** Ids of every node that has children, for "collapse all". */
export function collectHierarchyParentIds(nodes: WorkItemHierarchyNode[]): number[] {
  const ids: number[] = [];
  const visit = (node: WorkItemHierarchyNode) => {
    if (node.children.length > 0 && node.item.id != null) ids.push(node.item.id);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
}

import type { QueryHierarchyItem, WorkItemQueryResult } from '../types';

export interface FlatQueryNode {
  item: QueryHierarchyItem;
  depth: number;
  parentId: string | null;
}

/**
 * Depth-first flatten of a query hierarchy for search / list UIs.
 */
export function flattenQueryHierarchy(
  roots: readonly QueryHierarchyItem[],
): FlatQueryNode[] {
  const out: FlatQueryNode[] = [];

  function walk(
    nodes: readonly QueryHierarchyItem[],
    depth: number,
    parentId: string | null,
  ) {
    for (const item of nodes) {
      out.push({ item, depth, parentId });
      if (item.children?.length) {
        walk(item.children, depth + 1, item.id);
      }
    }
  }

  walk(roots, 0, null);
  return out;
}

/**
 * Collects runnable (non-folder) queries matching a free-text filter.
 */
export function filterRunnableQueries(
  roots: readonly QueryHierarchyItem[],
  search: string,
): FlatQueryNode[] {
  const q = search.trim().toLowerCase();
  return flattenQueryHierarchy(roots).filter(({ item }) => {
    if (item.isFolder || item.isDeleted) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.path?.toLowerCase().includes(q) ?? false)
    );
  });
}

/**
 * Extracts unique work item ids from flat or link-style WIQL results.
 */
export function collectWorkItemIdsFromQueryResult(result: WorkItemQueryResult): number[] {
  const ids = new Set<number>();

  for (const ref of result.workItems ?? []) {
    if (Number.isInteger(ref.id) && ref.id > 0) ids.add(ref.id);
  }

  for (const relation of result.workItemRelations ?? []) {
    const sourceId = relation.source?.id;
    const targetId = relation.target?.id;
    if (sourceId != null && Number.isInteger(sourceId) && sourceId > 0) {
      ids.add(sourceId);
    }
    if (targetId != null && Number.isInteger(targetId) && targetId > 0) {
      ids.add(targetId);
    }
  }

  return [...ids];
}

/** Encode a query id or path for the Queries REST segment (keep `/` separators). */
export function encodeQueryPathSegment(idOrPath: string): string {
  return idOrPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

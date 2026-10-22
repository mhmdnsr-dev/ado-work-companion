'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';

import type { WorkItemHierarchyNode } from '@core/domain';
import { Button } from '@/components/ui/button';
import { WorkItemListCard } from '@/features/work-items/work-item-list-card';

export function collectHierarchyParentIds(nodes: WorkItemHierarchyNode[]): number[] {
  const ids: number[] = [];
  const visit = (node: WorkItemHierarchyNode) => {
    if (node.children.length > 0 && node.item.id != null) ids.push(node.item.id);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
}

function HierarchyNode({
  node,
  depth,
  collapsedIds,
  onToggle,
  onOpen,
}: {
  node: WorkItemHierarchyNode;
  depth: number;
  collapsedIds: Set<number>;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}) {
  const id = node.item.id;
  const hasChildren = node.children.length > 0;
  const expanded = !id || !collapsedIds.has(id);
  const childCount = node.children.length;

  return (
    <li>
      <div className="flex items-start gap-2">
        {hasChildren && id != null ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 size-8 shrink-0"
            aria-label={expanded ? 'Collapse children' : 'Expand children'}
            aria-expanded={expanded}
            onClick={() => onToggle(id)}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        ) : (
          <span className="mt-1 size-8 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <WorkItemListCard
            item={node.item}
            compact={depth > 0}
            childCount={childCount}
            onOpen={() => {
              if (id != null) onOpen(id);
            }}
          />
        </div>
      </div>

      {hasChildren && expanded ? (
        <ul className="mt-2 ml-4 flex flex-col gap-2 border-l border-border pl-3">
          {node.children.map((child) => (
            <HierarchyNode
              key={child.item.id ?? `${child.item.url}-${depth}`}
              node={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WorkItemHierarchyList({
  roots,
  collapsedIds,
  onToggle,
  onOpen,
}: {
  roots: WorkItemHierarchyNode[];
  collapsedIds: Set<number>;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {roots.map((node) => (
        <HierarchyNode
          key={node.item.id ?? node.item.url}
          node={node}
          depth={0}
          collapsedIds={collapsedIds}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

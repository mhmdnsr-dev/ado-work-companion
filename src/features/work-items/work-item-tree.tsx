'use client';

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ChevronRight, Paperclip } from 'lucide-react';

import {
  fieldNumber,
  fieldString,
  flattenVisibleHierarchy,
  identityDisplayName,
  listWorkItemAttachments,
  summarizeHierarchyNode,
  workItemStateInfo,
  type VisibleHierarchyRow,
  type WorkItemHierarchyNode,
  type WorkItemStateLookup,
  type WorkItemTypeLookup,
} from '@core/domain';
import type { WorkItem } from '@core/types';
import {
  STATE_DOT_CLASS,
  formatHours,
  usableStateColor,
  workItemTypeVisual,
} from '@/features/work-items/work-item-visuals';
import { cn } from '@/lib/utils';

/**
 * Horizontal step per tree level, from `--tree-indent` on the tree frame:
 * tighter on phones so deep Epic → Task chains keep room for titles.
 */
const INDENT = 'var(--tree-indent)';
/** Row inline-start padding before the chevron gutter. */
const ROW_PADDING = 4;
/** Centre of the 32px chevron gutter, relative to the gutter start. */
const GUTTER_CENTER = 16;
/** Vertical centre of the title line; rails elbow in here. */
const TITLE_CENTER = 20;
const NO_COLLAPSED: ReadonlySet<number> = new Set();

/** Wraps plain items as childless nodes so flat lists reuse the tree rows. */
export function toFlatNodes(items: WorkItem[]): WorkItemHierarchyNode[] {
  return items.map((item) => ({ item, children: [] }));
}

function railStyles(row: VisibleHierarchyRow): CSSProperties[] {
  const rails: CSSProperties[] = [];
  for (let level = 0; level < row.depth; level += 1) {
    const left = `calc(${INDENT} * ${level} + ${ROW_PADDING + GUTTER_CENTER}px)`;
    if (level < row.depth - 1) {
      // Pass-through rail for an ancestor level that still has siblings below.
      if (!row.ancestorIsLast[level + 1])
        rails.push({ left, top: 0, bottom: 0, width: 1 });
      continue;
    }
    rails.push(
      row.isLast
        ? { left, top: 0, height: TITLE_CENTER, width: 1 }
        : { left, top: 0, bottom: 0, width: 1 },
    );
    rails.push({
      left,
      top: TITLE_CENTER,
      height: 1,
      width: row.hasChildren ? GUTTER_CENTER - 6 : GUTTER_CENTER * 2,
    });
  }
  if (row.expanded) {
    const left = `calc(${INDENT} * ${row.depth} + ${ROW_PADDING + GUTTER_CENTER}px)`;
    rails.push({ left, top: TITLE_CENTER + 8, bottom: 0, width: 1 });
  }
  return rails;
}

export function WorkItemTree({
  roots,
  label,
  onOpen,
  collapsedIds = NO_COLLAPSED,
  onToggle,
  selectedId = null,
  contextIds = NO_COLLAPSED,
  stateLookup,
  typeLookup,
  className,
}: {
  roots: WorkItemHierarchyNode[];
  /** Accessible name of the tree. */
  label: string;
  onOpen: (id: number) => void;
  collapsedIds?: ReadonlySet<number>;
  onToggle?: (id: number) => void;
  /** The work item currently open in the detail sheet. */
  selectedId?: number | null;
  /** Ancestors loaded only to group matches; rendered muted. */
  contextIds?: ReadonlySet<number>;
  /** Process state categories and colours from the project's work item types. */
  stateLookup?: WorkItemStateLookup;
  /** Process type colours and icons, used for custom types. */
  typeLookup?: WorkItemTypeLookup;
  /** Overrides the frame, e.g. to drop the phone full-bleed inside a panel. */
  className?: string;
}) {
  const rows = useMemo(
    () => flattenVisibleHierarchy(roots, collapsedIds),
    [roots, collapsedIds],
  );
  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const [focusedId, setFocusedId] = useState<number | null>(null);

  const visibleIds = rows.map((row) => row.id);
  const tabbableId =
    focusedId != null && visibleIds.includes(focusedId)
      ? focusedId
      : selectedId != null && visibleIds.includes(selectedId)
        ? selectedId
        : (rows[0]?.id ?? null);

  function focusRow(id: number | null | undefined) {
    if (id == null) return;
    setFocusedId(id);
    rowRefs.current.get(id)?.focus();
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLLIElement>, index: number) {
    if (event.target !== event.currentTarget) return;
    const row = rows[index];
    if (!row || row.id == null) return;
    switch (event.key) {
      case 'ArrowDown':
        focusRow(rows[index + 1]?.id);
        break;
      case 'ArrowUp':
        focusRow(rows[index - 1]?.id);
        break;
      case 'Home':
        focusRow(rows[0]?.id);
        break;
      case 'End':
        focusRow(rows[rows.length - 1]?.id);
        break;
      case 'ArrowRight':
        if (!row.hasChildren) return;
        if (row.expanded) focusRow(rows[index + 1]?.id);
        else onToggle?.(row.id);
        break;
      case 'ArrowLeft':
        if (row.hasChildren && row.expanded) onToggle?.(row.id);
        else focusRow(row.parentId);
        break;
      case 'Enter':
      case ' ':
        onOpen(row.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div
      className={cn(
        '-mx-4 overflow-hidden border-y border-border bg-card [--tree-indent:14px] md:mx-0 md:rounded-lg md:border md:[--tree-indent:20px]',
        className,
      )}
    >
      <div
        aria-hidden
        className="flex items-center gap-2 border-b border-border px-4 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        <span className="flex-1">Title</span>
        <span className="hidden w-40 md:block">Assigned to</span>
        <span className="hidden md:block md:w-36">State</span>
        <span className="w-10 text-right">Rem.</span>
      </div>
      <ul role="tree" aria-label={label} className="flex flex-col">
        {rows.map((row, index) => (
          <WorkItemTreeRow
            key={row.id ?? `${row.node.item.url}-${index}`}
            row={row}
            isContext={row.id != null && contextIds.has(row.id)}
            stateLookup={stateLookup}
            typeLookup={typeLookup}
            selected={row.id != null && row.id === selectedId}
            tabbable={row.id === tabbableId}
            registerRef={(element) => {
              if (row.id == null) return;
              if (element) rowRefs.current.set(row.id, element);
              else rowRefs.current.delete(row.id);
            }}
            onFocus={() => setFocusedId(row.id)}
            onKeyDown={(event) => onRowKeyDown(event, index)}
            onOpen={() => row.id != null && onOpen(row.id)}
            onToggle={() => row.id != null && onToggle?.(row.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function WorkItemTreeRow({
  row,
  isContext,
  stateLookup,
  typeLookup,
  selected,
  tabbable,
  registerRef,
  onFocus,
  onKeyDown,
  onOpen,
  onToggle,
}: {
  row: VisibleHierarchyRow;
  isContext: boolean;
  stateLookup?: WorkItemStateLookup;
  typeLookup?: WorkItemTypeLookup;
  selected: boolean;
  tabbable: boolean;
  registerRef: (element: HTMLLIElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { item } = row.node;
  const id = item.id;
  const title = fieldString(item, 'System.Title') || 'Untitled';
  const type = fieldString(item, 'System.WorkItemType') || 'Work item';
  const state = fieldString(item, 'System.State') || '—';
  const assignee =
    identityDisplayName(item.fields?.['System.AssignedTo']) || 'Unassigned';
  const ownRemaining = fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork');
  const attachmentCount = listWorkItemAttachments(item.relations).length;
  const visual = workItemTypeVisual(type, typeLookup?.get(type.trim().toLowerCase()));
  const TypeIcon = visual.icon;
  const isParent = row.hasChildren;
  // Context parents roll up too: with "all children" off, that is your share
  // of the story (only your tasks are loaded under it).
  const summary = isParent ? summarizeHierarchyNode(row.node, stateLookup) : null;
  const stateInfo = workItemStateInfo(item, stateLookup);
  const stateColor = usableStateColor(stateInfo.color);
  const stateDot = (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        !stateColor && STATE_DOT_CLASS[stateInfo.category],
      )}
      style={stateColor ? { backgroundColor: stateColor } : undefined}
    />
  );
  const progress = summary && summary.total > 0 ? summary.completed / summary.total : 0;
  const childCount = row.node.children.length;
  const remaining = summary ? summary.remainingHours : ownRemaining;
  const accessibleName = [
    `${type} ${id}: ${title}`,
    state,
    summary ? `${summary.completed} of ${summary.total} done` : assignee,
    isContext ? 'outside your filters, shown to group matching items' : null,
    isParent && !row.expanded
      ? `${childCount} child${childCount === 1 ? '' : 'ren'} hidden`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <li
      ref={registerRef}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-setsize={row.setSize}
      aria-posinset={row.posInSet}
      aria-expanded={isParent ? row.expanded : undefined}
      aria-selected={selected}
      aria-label={accessibleName}
      data-work-item-id={id}
      tabIndex={tabbable ? 0 : -1}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus();
      }}
      onKeyDown={onKeyDown}
      onClick={onOpen}
      className={cn(
        'relative cursor-pointer border-b border-border/70 transition-colors outline-none last:border-b-0 hover:bg-accent/60 focus-visible:rounded-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:ring-inset',
        isParent && !isContext && 'bg-muted/50',
        selected &&
          'bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)] hover:bg-primary/15',
        row.depth > 0 && 'animate-in duration-200 fade-in-0 slide-in-from-top-1',
      )}
    >
      {railStyles(row).map((style, index) => (
        <span
          key={index}
          aria-hidden
          className="pointer-events-none absolute bg-border"
          style={style}
        />
      ))}
      <div
        className="flex items-start gap-2 pe-4"
        style={{
          paddingInlineStart: `calc(${INDENT} * ${row.depth} + ${ROW_PADDING}px)`,
        }}
      >
        {isParent ? (
          // Pointer-only hit area; keyboard users toggle with ←/→ on the row.
          <span
            aria-hidden
            data-tree-toggle
            className="-me-2 flex h-10 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform duration-200 ease-out',
                row.expanded && 'rotate-90',
              )}
              strokeWidth={2.4}
            />
          </span>
        ) : (
          <span aria-hidden className="-me-2 w-8 shrink-0" />
        )}

        <TypeIcon
          aria-hidden
          className={cn(
            'mt-3 size-4 shrink-0',
            visual.className,
            isContext && 'opacity-60',
          )}
          style={
            visual.customColor
              ? ({ '--wit-custom': visual.customColor } as CSSProperties)
              : undefined
          }
          strokeWidth={2.2}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
          <div className="flex min-w-0 items-start gap-2">
            {/* Phones get two lines: long ADO titles are unreadable when cut to one. */}
            <span
              className={cn(
                'line-clamp-2 min-w-0 text-sm leading-5 break-words md:line-clamp-1',
                isContext
                  ? 'text-muted-foreground'
                  : isParent
                    ? 'font-semibold text-foreground'
                    : 'text-foreground',
              )}
            >
              {title}
            </span>
            {isParent && !row.expanded ? (
              <span
                aria-hidden
                className="mt-0.5 shrink-0 rounded-full bg-secondary px-1.5 font-mono text-[11px] leading-4 font-semibold text-secondary-foreground tabular-nums"
              >
                {childCount}
              </span>
            ) : null}
          </div>
          {/* Wraps instead of overflowing; on phones it also carries the state. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-muted-foreground">
            <span className="flex max-w-full min-w-0 items-center gap-1.5 text-foreground md:hidden">
              {stateDot}
              <span className="truncate">{state}</span>
            </span>
            <span className="shrink-0">
              {type.replace(/^User /, '')}{' '}
              <span className="font-mono tabular-nums">{id}</span>
            </span>
            {summary ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className="flex h-1 w-12 shrink-0 overflow-hidden rounded-full bg-border md:w-14"
                >
                  <span
                    className="rounded-full bg-state-completed"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </span>
                <span className="font-mono tabular-nums">
                  {summary.completed}/{summary.total}
                </span>
              </span>
            ) : isContext ? null : (
              <span className="max-w-full truncate md:hidden">{assignee}</span>
            )}
            {/* Doesn't match the filters itself; shown to group the items below. */}
            {isContext ? <span className="truncate">Outside filters</span> : null}
            {attachmentCount > 0 ? (
              <span className="flex shrink-0 items-center gap-0.5">
                <Paperclip className="size-3" aria-hidden />
                {attachmentCount}
              </span>
            ) : null}
          </div>
        </div>

        <span className="hidden w-40 truncate pt-2.5 text-sm leading-5 text-muted-foreground md:block">
          {isParent ? '' : assignee}
        </span>
        <span className="hidden min-w-0 items-center gap-1.5 pt-2.5 text-sm leading-5 text-foreground md:flex md:w-36">
          {stateDot}
          <span className="truncate" title={state}>
            {state}
          </span>
        </span>
        <span className="w-10 pt-2.5 text-right font-mono text-sm leading-5 text-foreground tabular-nums">
          {remaining == null ? (
            <span className="text-muted-foreground">–</span>
          ) : (
            formatHours(remaining)
          )}
        </span>
      </div>
    </li>
  );
}

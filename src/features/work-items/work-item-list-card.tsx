'use client';

import {
  fieldNumber,
  fieldString,
  identityDisplayName,
  listWorkItemAttachments,
} from '@core/domain';
import type { WorkItem } from '@core/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChevronRight, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WorkItemListCard({
  item,
  onOpen,
  compact = false,
  childCount,
}: {
  item: WorkItem;
  onOpen: () => void;
  /** Denser presentation used for nested hierarchy children. */
  compact?: boolean;
  /** Shows a child count badge on expandable parent cards. */
  childCount?: number;
}) {
  const id = item.id;
  const title = fieldString(item, 'System.Title') || 'Untitled';
  const type = fieldString(item, 'System.WorkItemType') || 'Work item';
  const state = fieldString(item, 'System.State') || '—';
  const assignee =
    identityDisplayName(item.fields?.['System.AssignedTo']) || 'Unassigned';
  const priority = fieldNumber(item, 'Microsoft.VSTS.Common.Priority');
  const remainingHours = fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork');
  const changed = formatDate(fieldString(item, 'System.ChangedDate'));
  const tags = fieldString(item, 'System.Tags');
  const remainingLabel =
    remainingHours != null ? `${remainingHours} h remaining` : 'No remaining hours';
  const attachmentCount = listWorkItemAttachments(item.relations).length;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open work item ${id}: ${title}`}
      className={cn(
        'cursor-pointer gap-2 rounded-md transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-muted/60',
        compact ? 'py-2.5' : 'py-3 md:gap-3 md:py-4',
      )}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <CardHeader
        className={cn('flex-row items-center gap-3', compact ? 'px-3' : 'px-3 md:px-4')}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">#{id}</Badge>
            <Badge variant="secondary">{type}</Badge>
            <Badge>{state}</Badge>
            {priority != null && !compact ? (
              <Badge variant="outline" className="hidden md:inline-flex">
                Priority {priority}
              </Badge>
            ) : null}
            {childCount != null && childCount > 0 ? (
              <Badge variant="outline">
                {childCount} child{childCount === 1 ? '' : 'ren'}
              </Badge>
            ) : null}
            {!compact ? (
              <Badge className="hidden border-transparent bg-primary text-primary-foreground sm:inline-flex">
                {remainingLabel}
              </Badge>
            ) : null}
            {attachmentCount > 0 && !compact ? (
              <Badge variant="outline" className="gap-1">
                <Paperclip className="size-3" aria-hidden />
                {attachmentCount}
              </Badge>
            ) : null}
          </div>
          <CardTitle
            className={cn(
              'line-clamp-2 leading-snug',
              compact ? 'text-sm md:text-base' : 'text-base md:text-lg',
            )}
          >
            {title}
          </CardTitle>
          <CardDescription className="flex flex-wrap gap-x-2">
            {assignee}
            {compact ? null : <span className="sm:hidden">· {remainingLabel}</span>}
            {changed && !compact ? (
              <span className="hidden sm:inline">· Updated {changed}</span>
            ) : null}
          </CardDescription>
        </div>
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground md:hidden"
          aria-hidden
        />
      </CardHeader>
      {tags && !compact ? (
        <CardContent className="hidden px-4 pt-0 md:block">
          <p className="text-xs text-muted-foreground">Tags: {tags}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

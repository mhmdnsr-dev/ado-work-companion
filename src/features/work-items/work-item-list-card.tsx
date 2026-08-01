'use client';

import { fieldNumber, fieldString, identityDisplayName, listWorkItemAttachments } from '@core/domain';
import type { WorkItem } from '@core/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Paperclip } from 'lucide-react';

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
}: {
  item: WorkItem;
  onOpen: () => void;
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
      className="cursor-pointer gap-3 py-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <CardHeader className="gap-2 px-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">#{id}</Badge>
            <Badge variant="secondary">{type}</Badge>
            <Badge>{state}</Badge>
            {priority != null ? (
              <Badge variant="outline">Priority {priority}</Badge>
            ) : null}
            <Badge className="border-transparent bg-primary text-primary-foreground">
              {remainingLabel}
            </Badge>
            {attachmentCount > 0 ? (
              <Badge variant="outline" className="gap-1">
                <Paperclip className="size-3" aria-hidden />
                {attachmentCount}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-base leading-snug sm:text-lg">{title}</CardTitle>
          <CardDescription>
            {assignee}
            {changed ? ` · Updated ${changed}` : ''}
          </CardDescription>
        </div>
      </CardHeader>
      {tags ? (
        <CardContent className="px-4 pt-0">
          <p className="text-xs text-muted-foreground">Tags: {tags}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

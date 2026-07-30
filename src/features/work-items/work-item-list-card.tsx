'use client';

import { fieldNumber, fieldString, identityDisplayName } from '@core/domain';
import type { WorkItem } from '@core/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
  const changed = formatDate(fieldString(item, 'System.ChangedDate'));
  const tags = fieldString(item, 'System.Tags');

  return (
    <Card className="gap-3 py-4 transition-colors hover:bg-muted/30">
      <CardHeader className="gap-2 px-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">#{id}</Badge>
            <Badge variant="secondary">{type}</Badge>
            <Badge>{state}</Badge>
            {priority != null ? (
              <Badge variant="outline">Priority {priority}</Badge>
            ) : null}
          </div>
          <CardTitle className="text-base leading-snug sm:text-lg">{title}</CardTitle>
          <CardDescription>
            {assignee}
            {changed ? ` · Updated ${changed}` : ''}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="touch-target h-11 shrink-0"
          onClick={onOpen}
        >
          Open
        </Button>
      </CardHeader>
      {tags ? (
        <CardContent className="px-4 pt-0">
          <p className="text-xs text-muted-foreground">Tags: {tags}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

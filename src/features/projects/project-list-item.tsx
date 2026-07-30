'use client';

import { Check, Eye } from 'lucide-react';

import type { TeamProjectReference } from '@core/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatUpdated(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function friendlyState(state?: string): string | null {
  if (!state) return null;
  switch (state) {
    case 'wellFormed':
      return 'Ready';
    case 'createPending':
      return 'Creating';
    case 'new':
      return 'New';
    case 'deleting':
      return 'Deleting';
    case 'deleted':
      return 'Deleted';
    default:
      return state;
  }
}

export function ProjectListItem({
  project,
  isActive,
  onOpen,
  onSetActive,
}: {
  project: TeamProjectReference;
  isActive: boolean;
  onOpen: () => void;
  onSetActive: () => void;
}) {
  const updated = formatUpdated(project.lastUpdateTime);
  const stateLabel = friendlyState(project.state);

  return (
    <Card
      className={cn(
        'h-full gap-3 py-4 transition-colors',
        isActive && 'border-primary/50 bg-primary/5',
      )}
    >
      <CardHeader className="gap-2 px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{project.name}</CardTitle>
          {isActive ? (
            <Badge className="bg-success text-success-foreground">Current</Badge>
          ) : null}
        </div>
        <CardDescription className="line-clamp-2 min-h-10">
          {project.description?.trim() || 'No description yet'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <div className="flex flex-wrap gap-2">
          {stateLabel ? <Badge variant="secondary">{stateLabel}</Badge> : null}
          {project.visibility ? (
            <Badge variant="outline" className="capitalize">
              {project.visibility}
            </Badge>
          ) : null}
        </div>
        {updated ? (
          <p className="text-xs text-muted-foreground">Updated {updated}</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 px-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="touch-target h-11 flex-1 gap-1"
          onClick={onOpen}
        >
          <Eye className="size-4" />
          View
        </Button>
        <Button
          type="button"
          variant={isActive ? 'outline' : 'default'}
          size="sm"
          className="touch-target h-11 flex-1 gap-1"
          onClick={onSetActive}
          disabled={isActive}
        >
          <Check className="size-4" />
          {isActive ? 'In use' : 'Use project'}
        </Button>
      </CardFooter>
    </Card>
  );
}

'use client';

import { Check, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';

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

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

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
            <Badge className="bg-success text-success-foreground">Active</Badge>
          ) : null}
        </div>
        <CardDescription className="line-clamp-2 min-h-10">
          {project.description?.trim() || 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <div className="flex flex-wrap gap-2">
          {project.state ? (
            <Badge variant="secondary" className="font-mono text-xs">
              {project.state}
            </Badge>
          ) : null}
          {project.visibility ? (
            <Badge variant="outline" className="text-xs">
              {project.visibility}
            </Badge>
          ) : null}
        </div>
        <p
          className="truncate font-mono text-xs text-muted-foreground"
          title={project.id}
        >
          {project.id}
        </p>
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
          Details
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
          {isActive ? 'Selected' : 'Set active'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11"
          aria-label={`Copy id for ${project.name}`}
          onClick={() => void copyText('Project id', project.id)}
        >
          <Copy className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

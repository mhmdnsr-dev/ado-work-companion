'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import type { TeamProject } from '@core/types';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function formatUpdated(iso?: string): string {
  if (!iso) return '—';
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

function projectSummary(project: TeamProject): {
  process?: string;
  sourceControl?: string;
} {
  const process = project.capabilities?.processTemplate?.templateName;
  const sourceControl = project.capabilities?.versioncontrol?.sourceControlType;
  return {
    process: process?.trim() || undefined,
    sourceControl: sourceControl?.trim() || undefined,
  };
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="space-y-1 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {onCopy ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={onCopy}
          >
            <Copy className="size-3.5" />
            Copy
          </Button>
        ) : null}
      </div>
      <p className="text-sm break-words">{value}</p>
    </div>
  );
}

export function ProjectDetailSheet({
  open,
  onOpenChange,
  projectIdOrName,
  projectName,
  isActive,
  onSetActive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectIdOrName: string | null;
  projectName?: string;
  isActive: boolean;
  onSetActive: () => void;
}) {
  const { api, settings } = useConnection();
  const id = projectIdOrName?.trim() || '';

  const detailQuery = useQuery({
    queryKey: adoQueryKeys.projects.detail(settings.organization, id),
    enabled: open && Boolean(api && id),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Azure DevOps client is not ready.');
      return api.getProject(id, { signal, includeCapabilities: true });
    },
  });

  const project = detailQuery.data?.data;
  const summary = project ? projectSummary(project) : {};
  const stateLabel = friendlyState(project?.state);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-dvh max-h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-border pr-12">
          <SheetTitle>{project?.name ?? projectName ?? 'Project'}</SheetTitle>
          <SheetDescription>
            Review this project and set it as the workspace for your work items and
            queries.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <div className="space-y-4 py-4">
            {detailQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : null}

            {detailQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load project</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>
                    {detailQuery.error instanceof Error
                      ? detailQuery.error.message
                      : 'Unexpected error.'}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="touch-target h-11 w-fit"
                    onClick={() => void detailQuery.refetch()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {project ? (
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  {isActive ? (
                    <Badge className="bg-success text-success-foreground">
                      Active workspace
                    </Badge>
                  ) : null}
                  {stateLabel ? <Badge variant="secondary">{stateLabel}</Badge> : null}
                  {project.visibility ? (
                    <Badge variant="outline" className="capitalize">
                      {project.visibility}
                    </Badge>
                  ) : null}
                </div>

                <DetailRow
                  label="Name"
                  value={project.name}
                  onCopy={() => void copyText('Name', project.name)}
                />
                <DetailRow
                  label="Description"
                  value={project.description?.trim() || 'No description yet'}
                />
                <DetailRow
                  label="Last updated"
                  value={formatUpdated(project.lastUpdateTime)}
                />
                {project.defaultTeam?.name ? (
                  <DetailRow label="Default team" value={project.defaultTeam.name} />
                ) : null}
                {summary.process ? (
                  <DetailRow label="Process" value={summary.process} />
                ) : null}
                {summary.sourceControl ? (
                  <DetailRow label="Source control" value={summary.sourceControl} />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <SheetFooter className="shrink-0 border-t border-border sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="touch-target h-11 gap-2"
            disabled={isActive || !project}
            onClick={onSetActive}
          >
            <Check className="size-4" />
            {isActive ? 'Current workspace' : 'Use this project'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { FolderKanban, MessageSquare, Search } from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import { fieldString, identityDisplayName } from '@core/domain';
import type { IdentityRef } from '@core/types';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkItemCommentsPanel } from '@/features/work-items/work-item-comments-panel';
import { WorkItemDetailSheet } from '@/features/work-items/work-item-detail-sheet';

export function CommentsView() {
  const { settings, hydrated } = useConnection();
  const organization = settings.organization;
  const project = settings.project?.trim() ?? '';

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <CommentsViewContent
      key={`${organization}::${project}`}
      organization={organization}
      project={project}
    />
  );
}

function CommentsViewContent({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const { api } = useConnection();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFromUrl = searchParams.get('id')?.trim() ?? '';

  const [idInput, setIdInput] = useState(initialFromUrl);
  const [loadedId, setLoadedId] = useState<number | null>(() => {
    if (/^\d+$/.test(initialFromUrl)) return Number(initialFromUrl);
    return null;
  });
  const [teamId, setTeamId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  const teamsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.teams(organization, project),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeams({ project, signal });
    },
  });

  const teams = teamsQuery.data?.data ?? [];
  const effectiveTeamId = teamId || teams[0]?.id || '';
  const selectedTeam = teams.find((team) => team.id === effectiveTeamId) ?? null;
  const teamName = selectedTeam?.name ?? '';

  const membersQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.members(organization, project, teamName),
    enabled: Boolean(api && project && teamName),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeamMembers({ project, team: teamName, signal });
    },
  });

  const people = useMemo(() => {
    const map = new Map<string, IdentityRef>();
    for (const member of membersQuery.data?.data ?? []) {
      const identity = member.identity;
      if (!identity?.id) continue;
      map.set(identity.id, identity);
    }
    return [...map.values()].sort((a, b) =>
      (a.displayName ?? '').localeCompare(b.displayName ?? ''),
    );
  }, [membersQuery.data?.data]);

  const workItemQuery = useQuery({
    queryKey: adoQueryKeys.workItems.detail(organization, loadedId ?? 0),
    enabled: Boolean(api && project && loadedId),
    queryFn: async ({ signal }) => {
      if (!api || !loadedId) throw new Error('Connection is not ready.');
      return api.getWorkItem({
        id: loadedId,
        project,
        expand: 'None',
        signal,
      });
    },
  });

  const workItem = workItemQuery.data?.data;
  const title = workItem ? fieldString(workItem, 'System.Title') : '';
  const state = workItem ? fieldString(workItem, 'System.State') : '';
  const type = workItem ? fieldString(workItem, 'System.WorkItemType') : '';
  const assignee = workItem
    ? identityDisplayName(workItem.fields?.['System.AssignedTo']) || 'Unassigned'
    : '';

  function loadWorkItem() {
    const trimmed = idInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      toast.error('Enter a numeric work item ID.');
      return;
    }
    const id = Number(trimmed);
    setLoadedId(id);
    router.replace(`/comments?id=${id}`);
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Comments</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            List, add, and refresh comments on a work item.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Comments belong to work items inside a project. Pick one to continue.
            </span>
            <Button asChild className="touch-target h-11 shrink-0">
              <Link href="/projects">Browse projects</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Comments</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Open a work item in{' '}
          <span className="font-medium text-foreground">{project}</span> to read and add
          comments.
        </p>
      </header>

      <section
        aria-label="Work item lookup"
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.8fr)_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="comments-work-item-id">Work item ID</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="comments-work-item-id"
              inputMode="numeric"
              value={idInput}
              onChange={(event) => setIdInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  loadWorkItem();
                }
              }}
              placeholder="e.g. 1234"
              className="touch-target h-11 pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comments-team">Team for @mentions</Label>
          <Select
            value={effectiveTeamId || undefined}
            onValueChange={setTeamId}
            disabled={teams.length === 0}
          >
            <SelectTrigger id="comments-team" className="touch-target h-11 w-full">
              <SelectValue
                placeholder={teamsQuery.isLoading ? 'Loading…' : 'Select team'}
              />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            className="touch-target h-11 w-full gap-2 sm:w-auto"
            onClick={loadWorkItem}
          >
            <MessageSquare className="size-4" />
            Load comments
          </Button>
        </div>
      </section>

      {!loadedId ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <MessageSquare className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Enter a work item ID</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Load a work item to list existing comments, add a new one, or refresh the
            thread.
          </p>
        </div>
      ) : workItemQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : workItemQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load work item #{loadedId}</AlertTitle>
          <AlertDescription>
            {workItemQuery.error instanceof Error
              ? workItemQuery.error.message
              : 'Check the ID and project, then try again.'}
          </AlertDescription>
        </Alert>
      ) : workItem ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{loadedId}</Badge>
                  {type ? <Badge variant="secondary">{type}</Badge> : null}
                  {state ? <Badge>{state}</Badge> : null}
                </div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {title || 'Untitled'}
                </h2>
                <p className="text-sm text-muted-foreground">{assignee}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="touch-target h-11 shrink-0"
                onClick={() => setDetailOpen(true)}
              >
                Open details
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <WorkItemCommentsPanel
              workItemId={loadedId}
              project={project}
              people={people}
              top={100}
            />
          </div>
        </div>
      ) : null}

      <WorkItemDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        workItemId={loadedId}
        project={project}
        people={people}
        iterations={[]}
        onChanged={() => {
          void workItemQuery.refetch();
        }}
      />
    </div>
  );
}

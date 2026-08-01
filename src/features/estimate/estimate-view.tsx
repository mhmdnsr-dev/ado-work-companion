'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink,
  FolderKanban,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';

import { adoQueryKeys } from '@core/constants';
import { buildEstimateHubHomeUrl } from '@core/types/estimate-hub';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EstimateHubLiveSession } from '@/features/estimate/estimate-hub-live-session';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function EstimateView() {
  const { settings, hydrated } = useConnection();
  const organization = settings.organization;
  const project = settings.project?.trim() ?? '';

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <EstimateViewContent
      key={`${organization}::${project}`}
      organization={organization}
      project={project}
    />
  );
}

function EstimateViewContent({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const { api } = useConnection();
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);

  const hubHomeUrl =
    organization && project ? buildEstimateHubHomeUrl(organization, project) : null;

  const sessionsQuery = useQuery({
    queryKey: adoQueryKeys.estimate.hubSessions(organization, project),
    enabled: Boolean(api && organization && project),
    refetchInterval: 15_000,
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listEstimateHubSessions({ project, signal });
    },
  });

  const writeProbeQuery = useQuery({
    queryKey: adoQueryKeys.estimate.writeProbe(organization),
    enabled: Boolean(api && organization && project),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.probeEstimateHubWriteAccess({ signal });
    },
  });

  const writable = writeProbeQuery.data?.data.writable === true;
  const sessionsPayload = sessionsQuery.data?.data;
  const sessions = sessionsPayload?.sessions ?? [];
  const sessionsInaccessible = sessionsPayload?.accessible === false;

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Estimate</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Azure DevOps Estimate hub sessions for your project.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Estimate hub sessions are scoped to a team project.</span>
            <Button asChild className="touch-target h-11 shrink-0">
              <Link href="/settings">Open Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (liveSessionId && writable) {
    return (
      <EstimateHubLiveSession
        organization={organization}
        project={project}
        sessionId={liveSessionId}
        onLeave={() => setLiveSessionId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Estimate</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            The same planning sessions as Boards → Estimate in{' '}
            <span className="font-medium text-foreground">{project}</span>. Join opens the
            Azure DevOps Estimate hub so you stay in sync with teammates on the website.
          </p>
        </div>
        {hubHomeUrl ? (
          <Button asChild variant="outline" className="touch-target h-11 gap-2">
            <a href={hubHomeUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open Estimate hub
            </a>
          </Button>
        ) : null}
      </header>

      <Alert>
        <Users className="size-4" />
        <AlertTitle>Alongside Azure DevOps</AlertTitle>
        <AlertDescription>
          These sessions come from the <strong>ms-devlabs Estimate</strong> extension
          (same list as the ADO website). Story Points saved in a session still sync to
          work items everywhere. Voting itself happens in the Estimate hub
          {writable ? ', or experimentally live in this app when available' : ''}.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">Estimate hub sessions</CardTitle>
            <CardDescription>
              Sessions for {organization} / {project}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-target size-11 shrink-0"
            disabled={sessionsQuery.isFetching}
            onClick={() => void sessionsQuery.refetch()}
            aria-label="Refresh sessions"
          >
            <RefreshCw
              className={cn('size-4', sessionsQuery.isFetching && 'animate-spin')}
            />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsQuery.isLoading ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : sessionsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load Estimate hub sessions</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {sessionsQuery.error instanceof Error
                    ? sessionsQuery.error.message
                    : 'Unexpected error.'}
                </p>
                <p className="text-sm">
                  Your access token may need broader permissions, or Extension Data may
                  not be readable outside the Estimate hub. Use Open Estimate hub as a
                  fallback.
                </p>
                {hubHomeUrl ? (
                  <Button asChild variant="secondary" className="touch-target h-11 gap-2">
                    <a href={hubHomeUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Open Estimate hub
                    </a>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : sessionsInaccessible ? (
            <Alert>
              <AlertTitle>Estimate Extension Data not readable</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {sessionsPayload?.message ||
                    'This access token cannot list Estimate hub sessions outside the extension.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Use Open Estimate hub to join sessions on the Azure DevOps website.
                  Story Points saved there still sync to work items in this app.
                </p>
                {hubHomeUrl ? (
                  <Button asChild className="touch-target h-11 gap-2">
                    <a href={hubHomeUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Open Estimate hub
                    </a>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : sessions.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No Estimate hub sessions found for this project. Create one in Azure
                DevOps (Boards → Estimate), then refresh here.
              </p>
              {hubHomeUrl ? (
                <Button asChild className="touch-target h-11 gap-2">
                  <a href={hubHomeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Open Estimate hub
                  </a>
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-3">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{session.name}</p>
                      {session.isLegacy ? (
                        <Badge variant="outline">Legacy</Badge>
                      ) : null}
                    </div>
                    {session.info.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {session.info
                          .map((row) => `${row.label}: ${row.value}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                    {session.createdAt ? (
                      <p className="text-xs text-muted-foreground">
                        Created {formatTime(session.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="touch-target h-11 gap-2">
                      <a href={session.hubUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        Join in Azure DevOps
                      </a>
                    </Button>
                    {writable ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="touch-target h-11 gap-2"
                        onClick={() => setLiveSessionId(session.id)}
                      >
                        <Users className="size-4" />
                        Live in app (experimental)
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {writeProbeQuery.isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Checking live-in-app availability…
            </p>
          ) : writeProbeQuery.data && !writable ? (
            <p className="text-xs text-muted-foreground">
              Live-in-app voting is unavailable with this token (
              {writeProbeQuery.data.data.message ||
                'Extension Data write not permitted'}
              ). Use Join in Azure DevOps — that is the supported path.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

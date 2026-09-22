'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, RefreshCw } from 'lucide-react';

import { adoQueryKeys, STORAGE_KEYS } from '@core/constants';
import {
  buildIterationBurndownChartPath,
  buildMemberSprintStats,
  buildSprintBurndownApply,
  buildSprintBurndownFromWorkItems,
  buildSprintBurndownModel,
  buildSprintSnapshotFromWorkItems,
  filterWorkItemsByAssignee,
  type AnalyticsODataResponse,
  type SprintChartsResult,
  type WorkItemSnapshotBurndownRow,
} from '@core/domain';
import { AdoClientError } from '@core/types';
import type { AzureDevOpsApi } from '@core/api/azure-devops-api';
import type { IdentityRef, WorkItem } from '@core/types';
import { useConnection } from '@/components/providers';
import { SearchableSelect } from '@/components/shared/searchable-select';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SprintBurndownChart } from '@/features/dashboard/sprint-burndown-chart';
import { SprintHoursProgressChart } from '@/features/dashboard/sprint-hours-progress-chart';
import { SprintMemberTaskTable } from '@/features/dashboard/sprint-member-task-table';
import { SprintNativeBurndownImage } from '@/features/dashboard/sprint-native-burndown-image';
import { SprintStateBarChart } from '@/features/dashboard/sprint-state-bar-chart';
import { SprintTypeBarChart } from '@/features/dashboard/sprint-type-bar-chart';
import { cn } from '@/lib/utils';

const TEAM_OVERVIEW = '__team__';

function readStoredTeam(organization: string, project: string): string {
  if (typeof window === 'undefined' || !organization || !project) return '';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DASHBOARD_TEAM);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as {
      organization?: string;
      project?: string;
      team?: string;
    };
    if (
      parsed.organization === organization &&
      parsed.project === project &&
      typeof parsed.team === 'string'
    ) {
      return parsed.team;
    }
  } catch {
    return '';
  }
  return '';
}

function writeStoredTeam(organization: string, project: string, team: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.DASHBOARD_TEAM,
    JSON.stringify({ organization, project, team }),
  );
}

function readStoredMember(
  organization: string,
  project: string,
  team: string,
): string | null {
  if (typeof window === 'undefined' || !organization || !project || !team) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DASHBOARD_MEMBER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      organization?: string;
      project?: string;
      team?: string;
      memberId?: string;
    };
    if (
      parsed.organization === organization &&
      parsed.project === project &&
      parsed.team === team &&
      typeof parsed.memberId === 'string'
    ) {
      if (parsed.memberId === '') return TEAM_OVERVIEW;
      return parsed.memberId;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredMember(
  organization: string,
  project: string,
  team: string,
  memberId: string,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEYS.DASHBOARD_MEMBER,
    JSON.stringify({ organization, project, team, memberId }),
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tracking-tight">{value}</p>
    </div>
  );
}

async function loadSprintWorkItems(
  api: AzureDevOpsApi,
  params: { project: string; team: string; iterationId: string; signal?: AbortSignal },
): Promise<WorkItem[]> {
  const links = await api.getIterationWorkItems({
    project: params.project,
    team: params.team,
    iterationId: params.iterationId,
    signal: params.signal,
  });
  const ids = (links.data.workItemRelations ?? [])
    .map((relation) => relation.target?.id)
    .filter((id): id is number => typeof id === 'number' && id > 0);
  if (ids.length === 0) return [];
  const items = await api.getWorkItems({
    ids,
    project: params.project,
    signal: params.signal,
  });
  return items.data;
}

export function SprintBurndownPanel() {
  const { api, settings, hydrated } = useConnection();
  const organization = settings.organization;
  const project = settings.project?.trim() ?? '';

  const [teamName, setTeamName] = useState('');
  const [memberId, setMemberId] = useState('');
  const storedTeam = useMemo(
    () => readStoredTeam(organization, project),
    [organization, project],
  );

  const teamsQuery = useQuery({
    queryKey: adoQueryKeys.dashboard.teams(organization, project),
    enabled: Boolean(api && hydrated && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeams({ project, signal });
    },
  });

  const teams = teamsQuery.data?.data ?? [];
  const preferredTeam = teamName || storedTeam;
  const resolvedTeam =
    preferredTeam && teams.some((team) => team.name === preferredTeam)
      ? preferredTeam
      : '';

  const storedMember = useMemo(
    () => (resolvedTeam ? readStoredMember(organization, project, resolvedTeam) : null),
    [organization, project, resolvedTeam],
  );

  const currentUserQuery = useQuery({
    queryKey: adoQueryKeys.dashboard.currentUser(organization),
    enabled: Boolean(api && organization),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getAuthenticatedUser({ signal });
    },
    staleTime: 300_000,
  });

  const currentUserId = currentUserQuery.data?.data?.id ?? null;

  const membersQuery = useQuery({
    queryKey: adoQueryKeys.dashboard.members(organization, project, resolvedTeam),
    enabled: Boolean(api && project && resolvedTeam),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeamMembers({ project, team: resolvedTeam, signal });
    },
  });

  const members = useMemo(() => {
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

  const effectiveMemberKey = useMemo(() => {
    if (memberId === TEAM_OVERVIEW) return TEAM_OVERVIEW;
    if (memberId && members.some((member) => member.id === memberId)) return memberId;
    if (storedMember === TEAM_OVERVIEW) return TEAM_OVERVIEW;
    if (storedMember && members.some((member) => member.id === storedMember)) {
      return storedMember;
    }
    if (currentUserId && members.some((member) => member.id === currentUserId)) {
      return currentUserId;
    }
    return TEAM_OVERVIEW;
  }, [memberId, storedMember, currentUserId, members]);

  const selectedMember =
    effectiveMemberKey === TEAM_OVERVIEW
      ? null
      : (members.find((member) => member.id === effectiveMemberKey) ?? null);
  const isMemberView = Boolean(selectedMember?.id);

  const sprintQuery = useQuery({
    queryKey: adoQueryKeys.dashboard.currentSprint(organization, project, resolvedTeam),
    enabled: Boolean(api && project && resolvedTeam),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      const [iterations, teamSettings] = await Promise.all([
        api.listTeamIterations({
          project,
          team: resolvedTeam,
          timeframe: 'current',
          signal,
        }),
        api.getTeamSettings({ project, team: resolvedTeam, signal }),
      ]);
      const current = iterations.data[0] ?? null;
      const areaPath = teamSettings.data.teamFieldValues?.[0]?.value ?? null;
      return { current, areaPath, teamSettings: teamSettings.data };
    },
  });

  const currentSprint = sprintQuery.data?.current ?? null;
  const areaPath = sprintQuery.data?.areaPath ?? null;

  const chartsQuery = useQuery({
    queryKey: adoQueryKeys.dashboard.burndown(organization, project, resolvedTeam),
    enabled: Boolean(
      api &&
      project &&
      resolvedTeam &&
      currentSprint?.path &&
      currentSprint.attributes?.startDate &&
      currentSprint.attributes?.finishDate,
    ),
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<SprintChartsResult> => {
      if (!api || !currentSprint) throw new Error('Connection is not ready.');
      const sprintStart = currentSprint.attributes!.startDate!;
      const sprintEnd = currentSprint.attributes!.finishDate!;

      const items = await loadSprintWorkItems(api, {
        project,
        team: resolvedTeam,
        iterationId: currentSprint.id,
        signal,
      });

      const restBase = {
        items,
        snapshot: buildSprintSnapshotFromWorkItems(items),
        nativeChartPath: buildIterationBurndownChartPath({
          organization,
          project,
          team: resolvedTeam,
          iterationId: currentSprint.id,
          apiVersion: settings.apiVersion,
        }),
      };

      try {
        const apply = buildSprintBurndownApply({
          teamName: resolvedTeam,
          areaPath,
          iterationPath: currentSprint.path,
        });
        const result = await api.queryAnalytics<
          AnalyticsODataResponse<WorkItemSnapshotBurndownRow>
        >({
          project,
          entity: 'WorkItemSnapshot',
          apply,
          orderby: 'DateValue',
          signal,
        });
        return {
          ...restBase,
          model: buildSprintBurndownModel({
            rows: result.data.value,
            sprintStart,
            sprintEnd,
          }),
        };
      } catch (error) {
        if (
          error instanceof AdoClientError &&
          (error.statusCode === 401 || error.statusCode === 403)
        ) {
          return {
            ...restBase,
            model: buildSprintBurndownFromWorkItems({
              items,
              sprintStart,
              sprintEnd,
            }),
          };
        }
        throw error;
      }
    },
  });

  const teamModel = chartsQuery.data?.model ?? null;
  const teamSnapshot = chartsQuery.data?.snapshot ?? null;
  const nativeChartPath = chartsQuery.data?.nativeChartPath;
  const sprintItems = useMemo(
    () => chartsQuery.data?.items ?? [],
    [chartsQuery.data?.items],
  );

  const memberItems = useMemo(
    () =>
      selectedMember?.id ? filterWorkItemsByAssignee(sprintItems, selectedMember.id) : [],
    [sprintItems, selectedMember],
  );

  const memberStats = useMemo(
    () => (isMemberView ? buildMemberSprintStats(memberItems) : null),
    [isMemberView, memberItems],
  );

  const memberModel = useMemo(() => {
    if (
      !isMemberView ||
      !currentSprint?.attributes?.startDate ||
      !currentSprint.attributes.finishDate
    ) {
      return null;
    }
    return buildSprintBurndownFromWorkItems({
      items: memberItems,
      sprintStart: currentSprint.attributes.startDate,
      sprintEnd: currentSprint.attributes.finishDate,
    });
  }, [isMemberView, memberItems, currentSprint]);

  const memberSnapshot = useMemo(
    () =>
      memberStats
        ? buildSprintSnapshotFromWorkItems(memberItems, { tasksOnly: false })
        : null,
    [memberStats, memberItems],
  );

  const teamOptions = teams.map((team) => ({
    value: team.name,
    label: team.name,
    description: team.description,
  }));

  const memberOptions = [
    {
      value: TEAM_OVERVIEW,
      label: 'Team overview',
      description: 'Simple sprint summary for the team',
    },
    ...members.map((member) => ({
      value: member.id!,
      label:
        member.id === currentUserId
          ? `Me (${member.displayName ?? member.uniqueName ?? 'you'})`
          : (member.displayName ?? member.uniqueName ?? member.id!),
      description: member.uniqueName,
    })),
  ];

  const chartsError = chartsQuery.error;
  const usesRestTeamCharts = teamModel?.source === 'rest';

  if (!hydrated) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  if (!project) {
    return (
      <Alert>
        <FolderKanban className="size-4" />
        <AlertTitle>Choose a project for sprint charts</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Sprint charts need an active project and team with a current sprint.
          </span>
          <Button asChild className="touch-target h-11 shrink-0">
            <Link href="/settings">Open Settings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="gap-3 px-5 [.border-b]:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Sprint charts</CardTitle>
            <CardDescription>
              {isMemberView
                ? `Detailed sprint statistics for ${selectedMember?.displayName ?? 'this member'}.`
                : 'Team sprint overview — select a member for in-depth statistics.'}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11 gap-2"
            disabled={chartsQuery.isFetching || !resolvedTeam}
            onClick={() => {
              void sprintQuery.refetch();
              void chartsQuery.refetch();
              void membersQuery.refetch();
            }}
          >
            <RefreshCw
              className={cn('size-4', chartsQuery.isFetching && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dashboard-team">
              Team <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="dashboard-team"
              value={resolvedTeam}
              onChange={(value) => {
                setTeamName(value);
                setMemberId('');
                writeStoredTeam(organization, project, value);
              }}
              options={teamOptions}
              placeholder={
                teamsQuery.isLoading ? 'Loading teams…' : 'Select team (required)'
              }
              searchPlaceholder="Search teams…"
              disabled={teamsQuery.isLoading || teams.length === 0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dashboard-member">Member</Label>
            <SearchableSelect
              id="dashboard-member"
              value={effectiveMemberKey}
              onChange={(value) => {
                setMemberId(value);
                if (resolvedTeam) {
                  writeStoredMember(organization, project, resolvedTeam, value);
                }
              }}
              options={memberOptions}
              placeholder={
                !resolvedTeam
                  ? 'Select a team first'
                  : membersQuery.isLoading
                    ? 'Loading members…'
                    : 'Me'
              }
              searchPlaceholder="Search members…"
              disabled={!resolvedTeam || membersQuery.isLoading}
            />
          </div>
        </div>

        {currentSprint && resolvedTeam ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{currentSprint.name}</Badge>
            <Badge variant="outline">
              {formatDate(currentSprint.attributes?.startDate)} –{' '}
              {formatDate(currentSprint.attributes?.finishDate)}
            </Badge>
            {isMemberView ? (
              <Badge variant="outline">Member detail</Badge>
            ) : usesRestTeamCharts ? (
              <Badge variant="outline">Team overview</Badge>
            ) : null}
            {typeof teamModel?.metrics.daysRemaining === 'number' ? (
              <Badge variant="outline">
                {teamModel.metrics.daysRemaining} day
                {teamModel.metrics.daysRemaining === 1 ? '' : 's'} left
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 px-5">
        {teamsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load teams</AlertTitle>
            <AlertDescription>
              {teamsQuery.error instanceof Error
                ? teamsQuery.error.message
                : 'Unknown error'}
            </AlertDescription>
          </Alert>
        ) : null}

        {!teamsQuery.isLoading && teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams found in this project.</p>
        ) : null}

        {!resolvedTeam && !teamsQuery.isLoading && teams.length > 0 ? (
          <Alert>
            <AlertTitle>Select a team</AlertTitle>
            <AlertDescription>
              Choose a team above to load sprint charts for the current iteration.
            </AlertDescription>
          </Alert>
        ) : null}

        {resolvedTeam && sprintQuery.isLoading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : null}

        {resolvedTeam && !sprintQuery.isLoading && !currentSprint ? (
          <Alert>
            <AlertTitle>No current sprint</AlertTitle>
            <AlertDescription>
              This team has no iteration marked as current. Set a current sprint in Azure
              DevOps, then refresh.
            </AlertDescription>
          </Alert>
        ) : null}

        {resolvedTeam && chartsQuery.isLoading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : null}

        {chartsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load sprint charts</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {chartsError instanceof Error ? chartsError.message : 'Query failed.'}
              </p>
              {chartsError instanceof AdoClientError &&
              chartsError.suggestions.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {chartsError.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Team overview — simple */}
        {!isMemberView && teamModel && !chartsQuery.isError ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricChip
                label="Open tasks"
                value={String(teamSnapshot?.openTaskCount ?? 0)}
              />
              <MetricChip
                label="Sprint completion"
                value={`${teamModel.metrics.completedPercent}%`}
              />
            </div>

            {usesRestTeamCharts && nativeChartPath ? (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">Sprint burndown</p>
                <SprintNativeBurndownImage
                  chartPath={nativeChartPath}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 bg-primary" />
                    Remaining work
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" />
                    Ideal
                  </span>
                </div>
                <SprintBurndownChart series={teamModel.series} className="h-56 w-full" />
              </div>
            )}
          </>
        ) : null}

        {/* Member detail — in-depth */}
        {isMemberView &&
        memberStats &&
        memberModel &&
        memberSnapshot &&
        !chartsQuery.isError ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MetricChip label="Assigned items" value={String(memberStats.totalTasks)} />
              <MetricChip
                label="Remaining work"
                value={`${memberStats.remainingHours} h`}
              />
              <MetricChip
                label="Completed"
                value={`${memberModel.metrics.completedPercent}%`}
              />
              <MetricChip
                label="Original estimate"
                value={`${memberStats.originalEstimateHours} h`}
              />
              <MetricChip label="Open tasks" value={String(memberStats.openTaskCount)} />
              <MetricChip
                label="Closed tasks"
                value={String(memberStats.completedTaskCount)}
              />
              <MetricChip
                label="Avg burndown"
                value={`${memberModel.metrics.averageBurndownPerDay} h/day`}
              />
              <MetricChip
                label="Completed hours"
                value={`${memberStats.completedHours} h`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex min-h-36 flex-col rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-3 text-xs text-muted-foreground">Items by state</p>
                <SprintStateBarChart snapshot={memberSnapshot} className="w-full" />
              </div>
              <div className="flex min-h-36 flex-col rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-3 text-xs text-muted-foreground">Items by type</p>
                <SprintTypeBarChart stats={memberStats} className="w-full" />
              </div>
              <div className="flex min-h-36 flex-col rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2 lg:col-span-1">
                <p className="mb-3 text-xs text-muted-foreground">Hours progress</p>
                <SprintHoursProgressChart snapshot={memberSnapshot} className="w-full" />
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2 lg:col-span-3">
                <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 bg-primary" />
                    Remaining work
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" />
                    Ideal
                  </span>
                </div>
                <SprintBurndownChart
                  series={memberModel.series}
                  className="h-48 w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Assigned work items</p>
              <SprintMemberTaskTable tasks={memberStats.tasks} />
            </div>
          </>
        ) : null}

        {chartsQuery.isSuccess &&
        !isMemberView &&
        teamModel &&
        teamModel.metrics.startingWork === 0 &&
        (teamSnapshot?.openTaskCount ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No task work in this sprint yet. Add Tasks with Remaining Work to see
            burndown.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

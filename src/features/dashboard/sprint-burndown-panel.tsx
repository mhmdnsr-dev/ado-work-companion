'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, FolderKanban, RefreshCw, Users } from 'lucide-react';

import { adoQueryKeys, STORAGE_KEYS } from '@core/constants';
import {
  buildIterationBurndownChartPath,
  buildMemberSprintStats,
  buildSprintBurndownApply,
  buildSprintBurndownFromWorkItems,
  buildSprintBurndownModel,
  buildSprintSnapshotFromWorkItems,
  buildSprintStateBreakdown,
  buildWorkItemStateLookup,
  buildWorkItemTypeLookup,
  filterWorkItemsByAssignee,
  isCountedSprintWork,
  isSprintWorkDone,
  selectOpenSprintWork,
  summarizeSprintWork,
  type AnalyticsODataResponse,
  type SprintChartsResult,
  type WorkItemSnapshotBurndownRow,
} from '@core/domain';
import { AdoClientError } from '@core/types';
import type { AzureDevOpsApi } from '@core/api/azure-devops-api';
import type { IdentityRef, WorkItem } from '@core/types';
import { useConnection } from '@/components/providers';
import { useCurrentUser, useMediaQuery } from '@/hooks';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SprintBurndownChart } from '@/features/dashboard/sprint-burndown-chart';
import { SprintNativeBurndownImage } from '@/features/dashboard/sprint-native-burndown-image';
import { SprintStateBar } from '@/features/dashboard/sprint-state-bar';
import { SprintSummary } from '@/features/dashboard/sprint-summary';
import { WorkItemTree, toFlatNodes } from '@/features/work-items/work-item-tree';
import { cn } from '@/lib/utils';

const WorkItemDetailSheet = dynamic(
  () =>
    import('@/features/work-items/work-item-detail-sheet').then((mod) => ({
      default: mod.WorkItemDetailSheet,
    })),
  { ssr: false },
);

/** The phone list stays short; the full list lives in Work Items. */
const OPEN_WORK_LIMIT = 20;

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
  // Relations tell leaf work (tasks) apart from containers (stories with tasks).
  const items = await api.getWorkItems({
    ids,
    project: params.project,
    expand: 'Relations',
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
  const [scopeOpen, setScopeOpen] = useState(false);
  const desktop = useMediaQuery('(min-width: 768px)');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
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

  const teams = useMemo(() => teamsQuery.data?.data ?? [], [teamsQuery.data?.data]);
  const preferredTeam = teamName || storedTeam;
  const validPreferredTeam =
    preferredTeam && teams.some((team) => team.name === preferredTeam)
      ? preferredTeam
      : '';
  // Default to the first team once teams load so sprint charts appear without
  // an extra manual step.
  const resolvedTeam = validPreferredTeam || teams[0]?.name || '';

  const storedMember = useMemo(
    () => (resolvedTeam ? readStoredMember(organization, project, resolvedTeam) : null),
    [organization, project, resolvedTeam],
  );

  const { currentUserId } = useCurrentUser();

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

  // Remember the automatic first-team default for the next visit.
  useEffect(() => {
    if (!hydrated || !project || !resolvedTeam) return;
    writeStoredTeam(organization, project, resolvedTeam);
  }, [hydrated, organization, project, resolvedTeam]);

  // Persist the automatic "Me" (or manually picked member) selection.
  useEffect(() => {
    if (!resolvedTeam || effectiveMemberKey === TEAM_OVERVIEW) return;
    writeStoredMember(organization, project, resolvedTeam, effectiveMemberKey);
  }, [effectiveMemberKey, organization, project, resolvedTeam]);

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

  const typesQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.types(organization, project),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemTypes({ project, signal });
    },
  });
  const workItemTypes = useMemo(
    () => typesQuery.data?.data ?? [],
    [typesQuery.data?.data],
  );
  const stateLookup = useMemo(
    () => buildWorkItemStateLookup(workItemTypes),
    [workItemTypes],
  );
  const typeLookup = useMemo(
    () => buildWorkItemTypeLookup(workItemTypes),
    [workItemTypes],
  );

  const memberModel = useMemo(() => {
    if (
      !isMemberView ||
      !currentSprint?.attributes?.startDate ||
      !currentSprint.attributes.finishDate
    ) {
      return null;
    }
    // Same set and "done" rule as the summary, so the chart's end equals the hero.
    return buildSprintBurndownFromWorkItems({
      items: memberItems,
      sprintStart: currentSprint.attributes.startDate,
      sprintEnd: currentSprint.attributes.finishDate,
      include: (item) => isCountedSprintWork(item, stateLookup),
      isCompleted: (item) => isSprintWorkDone(item, stateLookup),
    });
  }, [isMemberView, memberItems, currentSprint, stateLookup]);

  const scopedItems = isMemberView ? memberItems : sprintItems;
  const openWork = useMemo(
    () => selectOpenSprintWork(scopedItems, stateLookup),
    [scopedItems, stateLookup],
  );
  const openNodes = useMemo(
    () => toFlatNodes(openWork.slice(0, OPEN_WORK_LIMIT)),
    [openWork],
  );
  const breakdown = useMemo(
    () => buildSprintStateBreakdown(scopedItems, stateLookup),
    [scopedItems, stateLookup],
  );
  const workSummary = useMemo(
    () => summarizeSprintWork(scopedItems, stateLookup),
    [scopedItems, stateLookup],
  );

  const itemParam = searchParams.get('item');
  const selectedId = itemParam && /^\d+$/.test(itemParam) ? Number(itemParam) : null;

  function openItem(id: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('item', String(id));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function closeItem() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('item');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const teamOptions = teams.map((team) => ({
    value: team.name,
    label: team.name,
    description: team.description,
  }));

  const memberOptions = [
    {
      value: TEAM_OVERVIEW,
      label: 'Team overview',
      description: 'Sprint summary for the whole team',
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
  const memberLabel =
    memberOptions.find((option) => option.value === effectiveMemberKey)?.label ??
    'Team overview';
  const isMe = isMemberView && selectedMember?.id === currentUserId;

  const chartsError = chartsQuery.error;
  const usesRestTeamCharts = teamModel?.source === 'rest';
  const model = isMemberView ? memberModel : teamModel;
  const snapshot = isMemberView ? memberStats : teamSnapshot;
  const ready = Boolean(model && snapshot && !chartsQuery.isError);

  if (!hydrated) {
    return <Skeleton className="h-72 w-full rounded-xl" />;
  }

  if (!project) {
    return (
      <Alert>
        <FolderKanban className="size-4" />
        <AlertTitle>Choose a project for your sprint</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            The dashboard needs an active project and a team with a current sprint.
          </span>
          <Button asChild className="touch-target h-11 shrink-0">
            <Link href="/settings">Open Settings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Scope first, in one row above everything it filters. */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="touch-target h-11 min-w-0 flex-1 justify-start gap-2 md:flex-none"
          onClick={() => setScopeOpen(true)}
          aria-label={`Change team and member. Now ${resolvedTeam || 'no team'}, ${memberLabel}`}
        >
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {resolvedTeam || (teamsQuery.isLoading ? 'Loading teams…' : 'Select team')}
            <span className="text-muted-foreground"> · {isMe ? 'Me' : memberLabel}</span>
          </span>
          <ChevronDown
            className="ms-auto size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11 shrink-0 text-muted-foreground"
          aria-label="Refresh"
          title="Refresh"
          disabled={chartsQuery.isFetching || !resolvedTeam}
          onClick={() => {
            void sprintQuery.refetch();
            void chartsQuery.refetch();
            void membersQuery.refetch();
          }}
        >
          <RefreshCw className={cn('size-4', chartsQuery.isFetching && 'animate-spin')} />
        </Button>
      </div>

      {currentSprint && resolvedTeam ? (
        <p className="-mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{currentSprint.name}</span> ·{' '}
          {formatDate(currentSprint.attributes?.startDate)} –{' '}
          {formatDate(currentSprint.attributes?.finishDate)}
        </p>
      ) : null}

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

      {resolvedTeam && !sprintQuery.isLoading && !currentSprint ? (
        <Alert>
          <AlertTitle>No current sprint</AlertTitle>
          <AlertDescription>
            This team has no iteration marked as current. Set a current sprint in Azure
            DevOps, then refresh.
          </AlertDescription>
        </Alert>
      ) : null}

      {chartsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the sprint</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{chartsError instanceof Error ? chartsError.message : 'Query failed.'}</p>
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

      {resolvedTeam && (sprintQuery.isLoading || chartsQuery.isLoading) ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : null}

      {ready && model && snapshot ? (
        // Phones read top to bottom: numbers, then the work to update, then charts.
        // From lg the open work becomes the left column beside them.
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <section className="rounded-xl border border-border bg-card p-4 lg:col-start-2 lg:row-start-1">
            <SprintSummary
              scopeLabel={
                isMe
                  ? 'Your remaining work'
                  : isMemberView
                    ? `Remaining for ${selectedMember?.displayName ?? 'this member'}`
                    : 'Team remaining work'
              }
              remainingHours={model.metrics.remainingWork}
              completedHours={workSummary.completedHours}
              completedPercent={model.metrics.completedPercent}
              openCount={workSummary.openCount}
              closedCount={workSummary.closedCount}
              daysElapsed={model.metrics.daysElapsed}
              daysRemaining={model.metrics.daysRemaining}
            />
          </section>
          <section
            aria-labelledby="open-work-heading"
            className="space-y-2 lg:col-start-1 lg:row-span-4 lg:row-start-1"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="open-work-heading" className="text-sm font-semibold">
                {isMe ? 'Your open work' : 'Open work'}{' '}
                <span className="font-mono font-normal text-muted-foreground tabular-nums">
                  {openWork.length}
                </span>
              </h2>
              <Link
                href="/work-items"
                className="touch-target flex items-center text-xs font-semibold text-primary hover:underline"
              >
                All work items
              </Link>
            </div>
            {openWork.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing open in this sprint. Nice.
              </p>
            ) : (
              <>
                <WorkItemTree
                  label={isMe ? 'Your open work' : 'Open work'}
                  roots={openNodes}
                  onOpen={openItem}
                  selectedId={selectedId}
                  stateLookup={stateLookup}
                  typeLookup={typeLookup}
                />
                {openWork.length > OPEN_WORK_LIMIT ? (
                  <p className="text-xs text-muted-foreground">
                    Showing {OPEN_WORK_LIMIT} of {openWork.length}.{' '}
                    <Link
                      href="/work-items"
                      className="font-semibold text-primary hover:underline"
                    >
                      See all in Work Items
                    </Link>
                  </p>
                ) : null}
              </>
            )}
          </section>
          <section
            aria-labelledby="burndown-heading"
            className="space-y-3 rounded-xl border border-border bg-card p-4 lg:col-start-2"
          >
            <h2 id="burndown-heading" className="text-sm font-semibold">
              Burndown
            </h2>
            {!isMemberView && usesRestTeamCharts && nativeChartPath ? (
              <SprintNativeBurndownImage chartPath={nativeChartPath} className="w-full" />
            ) : (
              <SprintBurndownChart
                series={model.series}
                refreshing={chartsQuery.isFetching}
              />
            )}
          </section>
          <section
            aria-labelledby="state-heading"
            className="space-y-2 rounded-xl border border-border bg-card p-4 lg:col-start-2"
          >
            <h2 id="state-heading" className="text-sm font-semibold">
              By state
            </h2>
            <SprintStateBar slices={breakdown} />
          </section>
          {isMemberView && memberStats && memberModel ? (
            <details className="rounded-xl border border-border bg-card px-4 lg:col-start-2">
              <summary className="touch-target flex cursor-pointer items-center text-sm font-semibold">
                Sprint details
              </summary>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-4 text-sm">
                <dt className="text-muted-foreground">Original estimate</dt>
                <dd className="text-right font-mono tabular-nums">
                  {memberStats.originalEstimateHours}h
                </dd>
                <dt className="text-muted-foreground">Avg burndown</dt>
                <dd className="text-right font-mono tabular-nums">
                  {memberModel.metrics.averageBurndownPerDay}h/day
                </dd>
                <dt className="text-muted-foreground">Assigned items</dt>
                <dd className="text-right font-mono tabular-nums">
                  {memberStats.totalTasks}
                </dd>
                {memberStats.tasksByType.map((row) => (
                  <Fragment key={row.type}>
                    <dt className="ps-3 text-muted-foreground">{row.type}</dt>
                    <dd className="text-right font-mono tabular-nums">{row.count}</dd>
                  </Fragment>
                ))}
              </dl>
            </details>
          ) : null}
        </div>
      ) : null}

      {chartsQuery.isSuccess &&
      model &&
      model.metrics.startingWork === 0 &&
      openWork.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No task work in this sprint yet. Add Tasks with Remaining Work to see the
          burndown.
        </p>
      ) : null}

      <Sheet open={scopeOpen} onOpenChange={setScopeOpen}>
        <SheetContent
          side={desktop ? 'right' : 'bottom'}
          showCloseButton={false}
          className={cn(
            'gap-0 p-0',
            desktop
              ? 'w-full sm:max-w-md'
              : 'mobile-safe-bottom max-h-[88dvh] rounded-t-2xl',
          )}
        >
          {!desktop ? (
            <span
              aria-hidden
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border"
            />
          ) : null}
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-base">Sprint scope</SheetTitle>
            <SheetDescription className="text-xs">
              Pick the team whose current sprint to show, and whose work.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-team">Team</Label>
              <SearchableSelect
                id="dashboard-team"
                value={resolvedTeam}
                onChange={(value) => {
                  setTeamName(value);
                  setMemberId('');
                  writeStoredTeam(organization, project, value);
                }}
                options={teamOptions}
                placeholder={teamsQuery.isLoading ? 'Loading teams…' : 'Select team'}
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
                  if (resolvedTeam)
                    writeStoredMember(organization, project, resolvedTeam, value);
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
          <SheetFooter className="border-t border-border px-4 py-3">
            <SheetClose asChild>
              <Button type="button" className="touch-target h-11 w-full">
                Done
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <WorkItemDetailSheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) closeItem();
        }}
        workItemId={selectedId}
        project={project}
        people={members}
        iterations={
          currentSprint?.path
            ? [{ value: currentSprint.path, label: currentSprint.name }]
            : []
        }
        onChanged={() =>
          void queryClient.invalidateQueries({
            queryKey: adoQueryKeys.dashboard.burndown(
              organization,
              project,
              resolvedTeam,
            ),
          })
        }
      />
    </div>
  );
}

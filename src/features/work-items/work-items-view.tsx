'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys, STORAGE_KEYS } from '@core/constants';
import {
  buildWorkItemsListWiql,
  clearWorkItemFilters,
  emptyWorkItemFilters,
  fieldString,
  flattenClassificationPaths,
  identityUniqueName,
  parseWorkItemFilters,
  saveWorkItemFilters,
  type WorkItemFiltersState,
} from '@core/domain';
import type { IdentityRef, WorkItem } from '@core/types';
import { useConnection } from '@/components/providers';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { createLocalStorageAdapter } from '@/lib/adapters';
import { WorkItemCreateDialog } from '@/features/work-items/work-item-create-dialog';
import { WorkItemDetailSheet } from '@/features/work-items/work-item-detail-sheet';
import { WorkItemListCard } from '@/features/work-items/work-item-list-card';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

type StateFilter = 'open' | 'all' | 'closed';

function sortByChangedDate(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    const aDate = fieldString(a, 'System.ChangedDate');
    const bDate = fieldString(b, 'System.ChangedDate');
    return bDate.localeCompare(aDate);
  });
}

function initialFiltersFor(
  organization: string,
  project: string,
): WorkItemFiltersState {
  if (typeof window === 'undefined' || !organization || !project) {
    return emptyWorkItemFilters(organization, project);
  }
  return (
    parseWorkItemFilters(
      window.localStorage.getItem(STORAGE_KEYS.WORK_ITEM_FILTERS),
      organization,
      project,
    ) ?? emptyWorkItemFilters(organization, project)
  );
}

export function WorkItemsView() {
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
    <WorkItemsViewContent
      key={`${organization}::${project}`}
      organization={organization}
      project={project}
    />
  );
}

function WorkItemsViewContent({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const { api } = useConnection();
  const queryClient = useQueryClient();
  const storage = useMemo(() => createLocalStorageAdapter(), []);
  const initial = useMemo(
    () => initialFiltersFor(organization, project),
    [organization, project],
  );

  const [typeFilter, setTypeFilter] = useState(initial.typeFilter);
  const [stateFilter, setStateFilter] = useState<StateFilter>(initial.stateFilter);
  const [teamId, setTeamId] = useState(initial.teamId);
  const [sprintPath, setSprintPath] = useState(initial.sprintPath);
  const [assignedTo, setAssignedTo] = useState(initial.assignedTo);
  const [search, setSearch] = useState(initial.search);
  const [appliedSearch, setAppliedSearch] = useState(initial.search);
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const teamsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.teams(organization, project),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeams({ project, signal });
    },
  });

  const typesQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.types(organization, project),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemTypes({ project, signal });
    },
  });

  const teams = teamsQuery.data?.data ?? [];
  const workItemTypes = typesQuery.data?.data ?? [];
  const selectedTeam = teams.find((team) => team.id === teamId || team.name === teamId);
  const teamName = selectedTeam?.name ?? '';

  const membersQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.members(
      organization,
      project,
      teamName || '__all__',
    ),
    enabled: Boolean(api && project && teams.length > 0),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      const targetTeams = teamName
        ? teams.filter((team) => team.name === teamName)
        : teams.slice(0, 8);
      const collected: IdentityRef[] = [];
      for (const team of targetTeams) {
        const result = await api.listTeamMembers({
          project,
          team: team.name,
          signal,
        });
        for (const member of result.data) {
          if (member.identity) collected.push(member.identity);
        }
      }
      return {
        data: collected.map((identity) => ({ identity })),
        inspection: undefined,
      };
    },
  });

  const iterationsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.iterations(
      organization,
      project,
      teamName || 'project',
    ),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      if (teamName) {
        return api.listTeamIterations({ project, team: teamName, signal });
      }
      const tree = await api.getClassificationNode({
        project,
        structureGroup: 'iterations',
        depth: 5,
        signal,
      });
      const paths = flattenClassificationPaths(tree.data);
      return {
        data: paths.map((item) => ({
          id: item.path,
          name: item.name.split('\\').pop() ?? item.name,
          path: item.path,
        })),
        inspection: tree.inspection,
      };
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

  const filterKey = {
    type: typeFilter,
    state: stateFilter,
    search: appliedSearch,
    team: teamName,
    sprint: sprintPath,
    assignedTo,
  };

  const listQuery = useQuery({
    queryKey: adoQueryKeys.workItems.list(organization, project, filterKey),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');

      const trimmed = appliedSearch.trim();
      if (/^\d+$/.test(trimmed)) {
        const id = Number(trimmed);
        try {
          const single = await api.getWorkItem({
            id,
            project,
            signal,
            expand: 'Relations',
          });
          return { items: [single.data], asOf: new Date().toISOString() };
        } catch {
          return { items: [] as WorkItem[], asOf: new Date().toISOString() };
        }
      }

      let areaPaths = undefined as
        { value: string; includeChildren?: boolean }[] | undefined;
      if (teamName) {
        try {
          const settingsResult = await api.getTeamSettings({
            project,
            team: teamName,
            signal,
          });
          areaPaths = settingsResult.data.teamFieldValues;
        } catch {
          areaPaths = undefined;
        }
      }

      const wiql = buildWorkItemsListWiql({
        project,
        workItemType: typeFilter,
        stateScope: stateFilter,
        titleContains: trimmed || undefined,
        assignedTo: assignedTo || undefined,
        iterationPath: sprintPath || undefined,
        areaPaths,
      });

      const queried = await api.queryByWiql({
        query: wiql,
        top: 100,
        project,
        signal,
      });

      const ids = (queried.data.workItems ?? []).map((item) => item.id);
      if (ids.length === 0) {
        return { items: [] as WorkItem[], asOf: queried.data.asOf };
      }

      const batches: WorkItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const batch = await api.getWorkItems({
          ids: slice,
          project,
          signal,
          expand: 'Relations',
        });
        batches.push(...batch.data);
      }

      return { items: sortByChangedDate(batches), asOf: queried.data.asOf };
    },
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const teamOptions = teams.map((team) => ({
    value: team.id,
    label: team.name,
    description: team.description,
  }));

  const typeOptions = workItemTypes.map((type) => ({
    value: type.name,
    label: type.name,
    description: type.description,
  }));

  const sprintOptions = (iterationsQuery.data?.data ?? []).map((iteration) => ({
    value: iteration.path || iteration.name,
    label: iteration.name,
    description: iteration.path,
  }));

  const assigneeOptions = [
    { value: '@Me', label: 'Assigned to me' },
    { value: '__unassigned__', label: 'Unassigned' },
    ...people.map((person) => ({
      value: identityUniqueName(person),
      label: person.displayName || person.uniqueName || 'User',
      description: person.uniqueName,
    })),
  ];

  function applySearch() {
    setAppliedSearch(search.trim());
    setPage(0);
  }

  function openItem(id: number) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: adoQueryKeys.workItems.all });
  }

  async function onSaveFilters() {
    try {
      await saveWorkItemFilters(storage, {
        organization,
        project,
        typeFilter,
        stateFilter,
        teamId,
        sprintPath,
        assignedTo,
        search: appliedSearch || search.trim(),
      });
      toast.success('Filters saved for this project');
    } catch {
      toast.error('Could not save filters');
    }
  }

  async function onResetFilters() {
    const empty = emptyWorkItemFilters(organization, project);
    setTypeFilter(empty.typeFilter);
    setStateFilter(empty.stateFilter);
    setTeamId(empty.teamId);
    setSprintPath(empty.sprintPath);
    setAssignedTo(empty.assignedTo);
    setSearch(empty.search);
    setAppliedSearch(empty.search);
    setPage(0);
    try {
      await clearWorkItemFilters(storage);
      toast.success('Filters reset');
    } catch {
      toast.error('Could not clear saved filters');
    }
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Work Items
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Organize tasks, bugs, and user stories in a project.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Work items live inside a project. Pick one so you can create and manage the
              backlog.
            </span>
            <Button asChild className="touch-target h-11 shrink-0">
              <Link href="/settings">Open Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Work Items
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Track and update work in{' '}
            <span className="font-medium text-foreground">{project}</span>.
          </p>
        </div>
        <Button
          type="button"
          className="touch-target h-11 gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          New work item
        </Button>
      </header>

      <section
        aria-label="Work item filters"
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div className="space-y-2 sm:col-span-2 xl:col-span-3">
          <Label htmlFor="work-items-search">Search</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="work-items-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch();
                }}
                placeholder="Title or work item id…"
                className="touch-target h-11 pl-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="touch-target h-11 sm:w-28"
              onClick={applySearch}
            >
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-target h-11 gap-2 sm:w-28"
              disabled={listQuery.isFetching}
              onClick={() => void listQuery.refetch()}
            >
              <RefreshCw
                className={cn('size-4', listQuery.isFetching && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2 sm:col-span-2 xl:col-span-3">
          <p className="text-xs text-muted-foreground">
            Filters use teams, sprints, people, and types from your Azure DevOps project.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="touch-target h-11 gap-2"
              onClick={() => void onResetFilters()}
            >
              <RotateCcw className="size-4" />
              Reset filters
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="touch-target h-11 gap-2"
              onClick={() => void onSaveFilters()}
            >
              <Save className="size-4" />
              Save filters
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <SearchableSelect
            value={typeFilter === 'all' ? '' : typeFilter}
            onChange={(value) => {
              setTypeFilter(value || 'all');
              setPage(0);
            }}
            options={typeOptions}
            placeholder="All types"
            searchPlaceholder="Search types…"
            allowClear
            clearLabel="All types"
            disabled={typesQuery.isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="work-items-state">Status</Label>
          <Select
            value={stateFilter}
            onValueChange={(value) => {
              setStateFilter(value as StateFilter);
              setPage(0);
            }}
          >
            <SelectTrigger id="work-items-state" className="touch-target h-11 w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Done / closed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Team</Label>
          <SearchableSelect
            value={teamId}
            onChange={(value) => {
              setTeamId(value);
              setSprintPath('');
              setAssignedTo('');
              setPage(0);
            }}
            options={teamOptions}
            placeholder="All teams"
            searchPlaceholder="Search teams…"
            allowClear
            clearLabel="All teams"
          />
        </div>

        <div className="space-y-2">
          <Label>Sprint</Label>
          <SearchableSelect
            value={sprintPath}
            onChange={(value) => {
              setSprintPath(value);
              setPage(0);
            }}
            options={sprintOptions}
            placeholder="All sprints"
            searchPlaceholder="Search sprints…"
            allowClear
            clearLabel="All sprints"
            disabled={iterationsQuery.isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label>Assigned to</Label>
          <SearchableSelect
            value={assignedTo}
            onChange={(value) => {
              setAssignedTo(value);
              setPage(0);
            }}
            options={assigneeOptions}
            placeholder="Anyone"
            searchPlaceholder="Search people…"
            allowClear
            clearLabel="Anyone"
            disabled={membersQuery.isLoading}
          />
          {!teamName && people.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              People load from project teams when available.
            </p>
          ) : null}
        </div>
      </section>

      {listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load work items</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : 'Unexpected error loading work items.'}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="touch-target h-11 shrink-0"
              onClick={() => void listQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {listQuery.isLoading
          ? 'Loading work items…'
          : `${items.length} work item${items.length === 1 ? '' : 's'}`}
      </p>

      {listQuery.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No work items match these filters. Create one or broaden your search.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pageItems.map((item) => (
            <li key={item.id}>
              <WorkItemListCard item={item} onOpen={() => item.id && openItem(item.id)} />
            </li>
          ))}
        </ul>
      )}

      {items.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="touch-target size-11"
              disabled={safePage <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="touch-target size-11"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <WorkItemCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        project={project}
        people={people}
        iterations={sprintOptions}
        workItemTypes={workItemTypes.map((type) => type.name)}
        onCreated={(item) => {
          void invalidateList();
          if (item.id) {
            toast.success(`Created #${item.id}`);
            openItem(item.id);
          }
        }}
      />

      <WorkItemDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        workItemId={selectedId}
        project={project}
        people={people}
        iterations={sprintOptions}
        onChanged={() => void invalidateList()}
      />
    </div>
  );
}

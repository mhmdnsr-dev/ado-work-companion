'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  List,
  ListTree,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  SquareMinus,
  SquarePlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys, STORAGE_KEYS } from '@core/constants';
import {
  buildWorkItemHierarchy,
  buildWorkItemStateLookup,
  buildWorkItemTypeLookup,
  buildWorkItemsListWiql,
  clearCollapsedTreeIds,
  clearWorkItemFilters,
  collectHierarchyParentIds,
  emptyWorkItemFilters,
  fieldString,
  findCurrentIterationPath,
  flattenClassificationPaths,
  getWorkItemChildIds,
  getWorkItemParentId,
  identityUniqueName,
  isClosedWorkItemState,
  parseCollapsedTreeIds,
  parseWorkItemFilters,
  saveCollapsedTreeIds,
  saveWorkItemFilters,
  type IterationCandidate,
  type WorkItemFiltersState,
} from '@core/domain';
import type { IdentityRef, WorkItem } from '@core/types';
import type { AzureDevOpsApi } from '@core/api/azure-devops-api';
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
import { Switch } from '@/components/ui/switch';
import { createLocalStorageAdapter } from '@/lib/adapters';
import { WorkItemCreateDialog } from '@/features/work-items/work-item-create-dialog';
import { WorkItemTree, toFlatNodes } from '@/features/work-items/work-item-tree';
import { cn } from '@/lib/utils';

const WorkItemDetailSheet = dynamic(
  () =>
    import('@/features/work-items/work-item-detail-sheet').then((mod) => ({
      default: mod.WorkItemDetailSheet,
    })),
  { ssr: false },
);

const PAGE_SIZE = 12;
const HIERARCHY_PAGE_SIZE = 8;
const MAX_HIERARCHY_ITEMS = 300;
/** Ancestor levels fetched above the matches (Story → Feature → Epic → …). */
const MAX_ANCESTOR_ROUNDS = 4;

type StateFilter = 'open' | 'all' | 'closed';
type DisplayMode = WorkItemFiltersState['displayMode'];

function sortByChangedDate(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    const aDate = fieldString(a, 'System.ChangedDate');
    const bDate = fieldString(b, 'System.ChangedDate');
    return bDate.localeCompare(aDate);
  });
}

async function fetchWorkItemsByIds(
  api: AzureDevOpsApi,
  project: string,
  ids: number[],
  signal?: AbortSignal,
): Promise<WorkItem[]> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const items: WorkItem[] = [];
  for (let index = 0; index < unique.length; index += 200) {
    const batch = await api.getWorkItems({
      ids: unique.slice(index, index + 200),
      project,
      signal,
      expand: 'Relations',
    });
    items.push(...batch.data);
  }
  return items;
}

interface WorkItemsListResult {
  items: WorkItem[];
  /** Ancestors loaded only to group matches; the tree renders them muted. */
  contextIds: number[];
  asOf?: string;
}

/**
 * Adds the parent stories and child tasks/bugs needed to render an Azure-like
 * hierarchy, even when the current filters only matched one side of the link.
 * Ancestor-only items (for example a Feature above a matched User Story) are
 * loaded for grouping but are not expanded, so unrelated siblings stay hidden.
 * Those ancestors are reported as `contextIds`.
 */
async function enrichHierarchyItems(params: {
  api: AzureDevOpsApi;
  project: string;
  baseItems: WorkItem[];
  includeChildren: boolean;
  stateScope: StateFilter;
  signal?: AbortSignal;
}): Promise<{ items: WorkItem[]; contextIds: number[] }> {
  const { api, project, baseItems, includeChildren, stateScope, signal } = params;
  const byId = new Map<number, WorkItem>();
  for (const item of baseItems) {
    if (item.id != null && !byId.has(item.id)) byId.set(item.id, item);
  }
  const baseIds = new Set(byId.keys());

  const addItems = (items: WorkItem[]) => {
    const before = byId.size;
    for (const item of items) {
      if (item.id == null || byId.has(item.id)) continue;
      if (byId.size >= MAX_HIERARCHY_ITEMS) break;
      byId.set(item.id, item);
    }
    return byId.size !== before;
  };

  const missingParentIds = new Set<number>();
  for (const item of baseItems) {
    const parentId = getWorkItemParentId(item);
    if (parentId != null && !byId.has(parentId)) missingParentIds.add(parentId);
  }
  const parentIdsToFetch = [...missingParentIds].slice(
    0,
    Math.max(0, MAX_HIERARCHY_ITEMS - byId.size),
  );
  const directParents =
    parentIdsToFetch.length > 0
      ? await fetchWorkItemsByIds(api, project, parentIdsToFetch, signal)
      : [];
  addItems(directParents);
  const contextIds = new Set<number>();
  for (const parent of directParents) {
    if (parent.id != null) contextIds.add(parent.id);
  }

  if (includeChildren) {
    const expandable = new Map<number, WorkItem>();
    for (const item of baseItems) {
      if (item.id != null) expandable.set(item.id, item);
    }
    for (const parent of directParents) {
      if (parent.id == null) continue;
      const hasMatchedTaskOrBug = baseItems.some((base) => {
        if (getWorkItemParentId(base) !== parent.id) return false;
        const type = fieldString(base, 'System.WorkItemType').toLowerCase();
        return type === 'task' || type === 'bug';
      });
      if (hasMatchedTaskOrBug) {
        expandable.set(parent.id, parent);
        contextIds.delete(parent.id);
      }
    }

    const missingChildIds = new Set<number>();
    for (const item of expandable.values()) {
      for (const childId of getWorkItemChildIds(item)) {
        if (!byId.has(childId)) missingChildIds.add(childId);
      }
    }
    const childIdsToFetch = [...missingChildIds].slice(
      0,
      Math.max(0, MAX_HIERARCHY_ITEMS - byId.size),
    );
    if (childIdsToFetch.length > 0) {
      const children = await fetchWorkItemsByIds(api, project, childIdsToFetch, signal);
      addItems(children);
    }
  }

  // Walk up the hierarchy (Story → Feature → Epic, plus custom levels) so
  // matches sit under their full ancestry. Ancestors are context only: they
  // group the matches but their other children are never loaded.
  for (let round = 0; round < MAX_ANCESTOR_ROUNDS; round += 1) {
    const missingAncestorIds = new Set<number>();
    for (const item of byId.values()) {
      const parentId = getWorkItemParentId(item);
      if (parentId != null && !byId.has(parentId)) missingAncestorIds.add(parentId);
    }
    const ancestorIdsToFetch = [...missingAncestorIds].slice(
      0,
      Math.max(0, MAX_HIERARCHY_ITEMS - byId.size),
    );
    if (ancestorIdsToFetch.length === 0) break;
    const ancestors = await fetchWorkItemsByIds(api, project, ancestorIdsToFetch, signal);
    addItems(ancestors);
    for (const ancestor of ancestors) {
      if (ancestor.id != null) contextIds.add(ancestor.id);
    }
  }

  let items = [...byId.values()].filter((item) => {
    if (item.id == null || baseIds.has(item.id) || stateScope !== 'open') return true;
    return !isClosedWorkItemState(item);
  });
  // Hiding a closed ancestor can leave the levels above it with nothing to
  // group, so drop context rows that no longer have a loaded child.
  for (;;) {
    const parentIds = new Set(items.map(getWorkItemParentId));
    const kept = items.filter(
      (item) => item.id == null || !contextIds.has(item.id) || parentIds.has(item.id),
    );
    if (kept.length === items.length) break;
    items = kept;
  }
  return { items, contextIds: [...contextIds].filter((id) => byId.has(id)) };
}

function initialCollapsedIds(organization: string, project: string): Set<number> {
  if (typeof window === 'undefined' || !organization || !project) return new Set();
  return new Set(
    parseCollapsedTreeIds(
      window.localStorage.getItem(STORAGE_KEYS.WORK_ITEM_TREE_COLLAPSED),
      organization,
      project,
    ),
  );
}

function initialFiltersFor(organization: string, project: string): WorkItemFiltersState {
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initial.displayMode);
  const [includeChildren, setIncludeChildren] = useState(initial.includeChildren);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() =>
    initialCollapsedIds(organization, project),
  );
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const itemParam = searchParams.get('item');
  const selectedId = itemParam && /^\d+$/.test(itemParam) ? Number(itemParam) : null;
  const detailOpen = selectedId !== null;

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
          attributes: item.attributes,
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
    display: displayMode,
    includeChildren: includeChildren ? 'true' : 'false',
  };

  const listQuery = useQuery({
    queryKey: adoQueryKeys.workItems.list(organization, project, filterKey),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }): Promise<WorkItemsListResult> => {
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
          const enrichedSingle =
            displayMode === 'hierarchy'
              ? await enrichHierarchyItems({
                  api,
                  project,
                  baseItems: [single.data],
                  includeChildren,
                  stateScope: stateFilter,
                  signal,
                })
              : { items: [single.data], contextIds: [] };
          return {
            items: sortByChangedDate(enrichedSingle.items),
            contextIds: enrichedSingle.contextIds,
            asOf: new Date().toISOString(),
          };
        } catch {
          return { items: [], contextIds: [], asOf: new Date().toISOString() };
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
        return { items: [], contextIds: [], asOf: queried.data.asOf };
      }

      const batches = await fetchWorkItemsByIds(api, project, ids, signal);
      const enriched =
        displayMode === 'hierarchy'
          ? await enrichHierarchyItems({
              api,
              project,
              baseItems: batches,
              includeChildren,
              stateScope: stateFilter,
              signal,
            })
          : { items: batches, contextIds: [] };

      return {
        items: sortByChangedDate(enriched.items),
        contextIds: enriched.contextIds,
        asOf: queried.data.asOf,
      };
    },
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const hierarchy = useMemo(() => buildWorkItemHierarchy(items), [items]);
  const contextIds = useMemo(
    () => new Set(listQuery.data?.contextIds ?? []),
    [listQuery.data?.contextIds],
  );
  const flatNodes = useMemo(() => toFlatNodes(items), [items]);
  const matchedCount = items.filter(
    (item) => item.id == null || !contextIds.has(item.id),
  ).length;
  const pageSize = displayMode === 'hierarchy' ? HIERARCHY_PAGE_SIZE : PAGE_SIZE;
  const pageCount = Math.max(
    1,
    Math.ceil(
      (displayMode === 'hierarchy' ? hierarchy.roots.length : items.length) / pageSize,
    ),
  );
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = flatNodes.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const pageRoots = hierarchy.roots.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );

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

  const iterationCandidates: IterationCandidate[] = (
    iterationsQuery.data?.data ?? []
  ).map((iteration) => {
    const rawAttributes: Record<string, unknown> | undefined =
      'attributes' in iteration && iteration.attributes
        ? (iteration.attributes as Record<string, unknown>)
        : undefined;
    const attributes = rawAttributes
      ? {
          startDate:
            typeof rawAttributes.startDate === 'string' ? rawAttributes.startDate : null,
          finishDate:
            typeof rawAttributes.finishDate === 'string'
              ? rawAttributes.finishDate
              : null,
          timeFrame:
            typeof rawAttributes.timeFrame === 'string'
              ? rawAttributes.timeFrame
              : undefined,
        }
      : undefined;
    return {
      name: iteration.name,
      path: iteration.path || iteration.name,
      attributes,
    };
  });

  const sprintOptions = iterationCandidates.map((iteration) => ({
    value: iteration.path || iteration.name,
    label: iteration.name,
    description: iteration.path,
  }));

  const currentSprintPath = findCurrentIterationPath(iterationCandidates);

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
        displayMode,
        includeChildren,
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
    setDisplayMode(empty.displayMode);
    setIncludeChildren(empty.includeChildren);
    setCollapsedIds(new Set());
    setPage(0);
    try {
      await Promise.all([clearWorkItemFilters(storage), clearCollapsedTreeIds(storage)]);
      toast.success('Filters reset');
    } catch {
      toast.error('Could not clear saved filters');
    }
  }

  function updateCollapsed(next: Set<number>) {
    setCollapsedIds(next);
    void saveCollapsedTreeIds(storage, organization, project, next).catch(() => {
      // Remembering the tree shape is a convenience; never block on it.
    });
  }

  function toggleCollapsed(id: number) {
    const next = new Set(collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateCollapsed(next);
  }

  function expandAllGroups() {
    updateCollapsed(new Set());
  }

  function collapseAllGroups() {
    updateCollapsed(new Set(collectHierarchyParentIds(hierarchy.roots)));
  }

  function changeDisplayMode(mode: DisplayMode) {
    setDisplayMode(mode);
    setPage(0);
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
      <header className="hidden flex-col gap-3 md:flex md:flex-row md:items-end md:justify-between">
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
          className="touch-target hidden h-11 gap-2 md:inline-flex"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          New work item
        </Button>
      </header>

      <section aria-label="Search work items" className="space-y-2 md:hidden">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && applySearch()}
              aria-label="Search work items"
              placeholder="Title or ID"
              className="touch-target h-11 pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-target size-11 shrink-0"
            onClick={() => setFilterOpen(true)}
            aria-label="Open filters"
          >
            <SlidersHorizontal className="size-5" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9"
            onClick={applySearch}
          >
            Search
          </Button>
          <p className="text-xs text-muted-foreground">
            {
              [
                typeFilter !== 'all',
                stateFilter !== 'open',
                Boolean(teamId),
                Boolean(sprintPath),
                assignedTo !== '@Me',
              ].filter(Boolean).length
            }{' '}
            active filters
          </p>
        </div>
      </section>

      {filterOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close filters"
          onClick={() => setFilterOpen(false)}
        />
      ) : null}

      {itemParam && selectedId === null ? (
        <Alert variant="destructive">
          <AlertTitle>Invalid work item link</AlertTitle>
          <AlertDescription>The work item ID in this URL is not valid.</AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label="Work item filters"
        className={cn(
          'gap-3 border-border bg-background p-4 md:grid md:grid-cols-2 md:rounded-lg md:border xl:grid-cols-3',
          filterOpen
            ? 'mobile-safe-bottom fixed inset-x-0 bottom-0 z-50 grid max-h-[88dvh] overflow-y-auto rounded-t-xl border-t md:static md:max-h-none md:overflow-visible'
            : 'hidden md:grid',
        )}
      >
        <div className="flex items-center justify-between md:hidden">
          <div>
            <h2 className="font-semibold">Filters</h2>
            <p className="text-xs text-muted-foreground">Narrow the current project</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="touch-target size-11"
            onClick={() => setFilterOpen(false)}
            aria-label="Close filters"
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="hidden space-y-2 md:col-span-2 md:block xl:col-span-3">
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

        {displayMode === 'hierarchy' ? (
          <div className="space-y-2">
            <Label htmlFor="work-items-include-children">Tree</Label>
            <div className="flex h-11 items-center justify-between gap-3 rounded-md border border-border px-3">
              <Label
                htmlFor="work-items-include-children"
                className="text-sm font-normal text-muted-foreground"
              >
                Include child tasks/bugs
              </Label>
              <Switch
                id="work-items-include-children"
                checked={includeChildren}
                onCheckedChange={(checked) => {
                  setIncludeChildren(checked);
                  setPage(0);
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Team</Label>
          <SearchableSelect
            value={teamId}
            onChange={(value) => {
              setTeamId(value);
              setSprintPath('');
              setAssignedTo('@Me');
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
        <Button
          type="button"
          className="touch-target h-11 md:hidden"
          onClick={() => setFilterOpen(false)}
        >
          Show work items
        </Button>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {listQuery.isLoading
            ? 'Loading work items…'
            : displayMode === 'hierarchy'
              ? `${matchedCount} work item${matchedCount === 1 ? '' : 's'} in ${
                  hierarchy.roots.length
                } group${hierarchy.roots.length === 1 ? '' : 's'}`
              : `${items.length} work item${items.length === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-1">
          <div
            role="group"
            aria-label="Display"
            className="flex rounded-md border border-border bg-muted/40 p-0.5"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={displayMode === 'list'}
              className={cn(
                'h-9 gap-1.5 px-2.5 text-muted-foreground',
                displayMode === 'list' &&
                  'bg-background text-foreground shadow-xs hover:bg-background',
              )}
              onClick={() => changeDisplayMode('list')}
            >
              <List className="size-4" aria-hidden />
              List
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={displayMode === 'hierarchy'}
              className={cn(
                'h-9 gap-1.5 px-2.5 text-muted-foreground',
                displayMode === 'hierarchy' &&
                  'bg-background text-foreground shadow-xs hover:bg-background',
              )}
              onClick={() => changeDisplayMode('hierarchy')}
            >
              <ListTree className="size-4" aria-hidden />
              Tree
            </Button>
          </div>
          {displayMode === 'hierarchy' && hierarchy.roots.length > 0 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target text-muted-foreground"
                aria-label="Expand all"
                title="Expand all"
                onClick={expandAllGroups}
              >
                <SquarePlus className="size-[18px]" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target text-muted-foreground"
                aria-label="Collapse all"
                title="Collapse all"
                onClick={collapseAllGroups}
              >
                <SquareMinus className="size-[18px]" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="-mx-4 overflow-hidden border-y border-border md:mx-0 md:rounded-lg md:border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
            >
              <Skeleton className="size-4 rounded-sm" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : (displayMode === 'hierarchy' ? pageRoots : pageItems).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No work items match these filters. Create one or broaden your search.
        </div>
      ) : displayMode === 'hierarchy' ? (
        <WorkItemTree
          label="Work items"
          roots={pageRoots}
          collapsedIds={collapsedIds}
          onToggle={toggleCollapsed}
          onOpen={openItem}
          selectedId={selectedId}
          contextIds={contextIds}
          stateLookup={stateLookup}
          typeLookup={typeLookup}
        />
      ) : (
        <WorkItemTree
          label="Work items"
          roots={pageItems}
          onOpen={openItem}
          selectedId={selectedId}
          stateLookup={stateLookup}
          typeLookup={typeLookup}
        />
      )}

      {pageCount > 1 ? (
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
        defaultIterationPath={currentSprintPath}
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
        onOpenChange={(open) => {
          if (!open) closeItem();
        }}
        workItemId={selectedId}
        project={project}
        people={people}
        iterations={sprintOptions}
        onChanged={() => void invalidateList()}
      />
      {/* Lets the last row and the pager scroll clear of the floating button. */}
      <div aria-hidden className="h-16 md:hidden" />
      <Button
        type="button"
        size="icon"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden"
        onClick={() => setCreateOpen(true)}
        aria-label="New work item"
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}

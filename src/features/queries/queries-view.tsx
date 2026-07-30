'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderKanban,
  FileSearch,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';

import { adoQueryKeys } from '@core/constants';
import {
  collectWorkItemIdsFromQueryResult,
  fieldString,
  filterRunnableQueries,
} from '@core/domain';
import type { QueryHierarchyItem, WorkItem } from '@core/types';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkItemDetailSheet } from '@/features/work-items/work-item-detail-sheet';
import { WorkItemListCard } from '@/features/work-items/work-item-list-card';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;
const RUN_TOP = 100;

function sortByChangedDate(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    const aDate = fieldString(a, 'System.ChangedDate');
    const bDate = fieldString(b, 'System.ChangedDate');
    return bDate.localeCompare(aDate);
  });
}

function applyFolderChildren(
  nodes: QueryHierarchyItem[],
  folderChildren: Record<string, QueryHierarchyItem[]>,
): QueryHierarchyItem[] {
  return nodes.map((node) => {
    const loaded = folderChildren[node.id];
    const baseChildren = loaded ?? node.children;
    const children = baseChildren
      ? applyFolderChildren(baseChildren, folderChildren)
      : undefined;
    return children ? { ...node, children, hasChildren: true } : node;
  });
}

export function QueriesView() {
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
    <QueriesViewContent
      key={`${organization}::${project}`}
      organization={organization}
      project={project}
    />
  );
}

function QueriesViewContent({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const { api } = useConnection();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);
  const [folderChildren, setFolderChildren] = useState<
    Record<string, QueryHierarchyItem[]>
  >({});
  const [runToken, setRunToken] = useState(0);
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: adoQueryKeys.queries.list(organization, project),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listQueries({
        depth: 2,
        expand: 'None',
        project,
        signal,
      });
    },
  });

  const baseRoots = useMemo(() => listQuery.data?.data ?? [], [listQuery.data?.data]);

  const roots = useMemo(
    () => applyFolderChildren(baseRoots, folderChildren),
    [baseRoots, folderChildren],
  );

  const resolvedExpanded = useMemo(() => {
    if (expandedIds) return expandedIds;
    return new Set(baseRoots.map((root) => root.id));
  }, [expandedIds, baseRoots]);

  const detailQuery = useQuery({
    queryKey: adoQueryKeys.queries.detail(organization, project, selectedId ?? ''),
    enabled: Boolean(api && project && selectedId),
    queryFn: async ({ signal }) => {
      if (!api || !selectedId) throw new Error('Connection is not ready.');
      return api.getQuery({
        idOrPath: selectedId,
        expand: 'Wiql',
        project,
        signal,
      });
    },
  });

  const selectedQuery = detailQuery.data?.data;
  const canRun = Boolean(selectedQuery && !selectedQuery.isFolder && selectedQuery.id);

  const runQuery = useQuery({
    queryKey: [
      ...adoQueryKeys.queries.run(organization, project, selectedId ?? ''),
      runToken,
    ],
    enabled: Boolean(api && project && selectedId && runToken > 0 && canRun),
    queryFn: async ({ signal }) => {
      if (!api || !selectedId) throw new Error('Connection is not ready.');

      const queried = await api.queryById({
        id: selectedId,
        top: RUN_TOP,
        project,
        signal,
      });

      const ids = collectWorkItemIdsFromQueryResult(queried.data);
      if (ids.length === 0) {
        return {
          items: [] as WorkItem[],
          asOf: queried.data.asOf,
          queryType: queried.data.queryType,
          truncated: false,
        };
      }

      const batches: WorkItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const batch = await api.getWorkItems({ ids: slice, project, signal });
        batches.push(...batch.data);
      }

      return {
        items: sortByChangedDate(batches),
        asOf: queried.data.asOf,
        queryType: queried.data.queryType,
        truncated: ids.length >= RUN_TOP,
      };
    },
  });

  const searchable = useMemo(() => filterRunnableQueries(roots, search), [roots, search]);

  const showSearchResults = search.trim().length > 0;

  const results = runQuery.data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = results.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleExpanded = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const current = prev ?? new Set(baseRoots.map((root) => root.id));
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [baseRoots],
  );

  const loadFolderChildren = useCallback(
    async (folder: QueryHierarchyItem) => {
      if (!api || !project) return;
      if (folder.children?.length) return;
      if (!folder.hasChildren) return;

      setLoadingFolderId(folder.id);
      try {
        const result = await api.getQuery({
          idOrPath: folder.id,
          depth: 1,
          expand: 'None',
          project,
        });
        const children = result.data.children ?? [];
        setFolderChildren((prev) =>
          prev[folder.id] ? prev : { ...prev, [folder.id]: children },
        );
      } finally {
        setLoadingFolderId(null);
      }
    },
    [api, project],
  );

  async function onExpandFolder(folder: QueryHierarchyItem) {
    const willExpand = !resolvedExpanded.has(folder.id);
    toggleExpanded(folder.id);
    if (willExpand) {
      await loadFolderChildren(folder);
    }
  }

  function selectQuery(item: QueryHierarchyItem) {
    if (item.isFolder) {
      void onExpandFolder(item);
      return;
    }
    setSelectedId(item.id);
    setRunToken(0);
    setPage(0);
  }

  function onRun() {
    if (!canRun || !selectedId) return;
    setPage(0);
    setRunToken((token) => token + 1);
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Queries</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Browse and run saved work item queries.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Saved queries live inside a project. Pick one to browse My Queries and
              Shared Queries.
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Queries</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Browse and run saved queries in{' '}
            <span className="font-medium text-foreground">{project}</span>.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="touch-target h-11 gap-2"
          disabled={listQuery.isFetching}
          onClick={() => {
            setFolderChildren({});
            setExpandedIds(null);
            void listQuery.refetch();
            void queryClient.invalidateQueries({
              queryKey: adoQueryKeys.queries.all,
            });
          }}
        >
          <RefreshCw className={cn('size-4', listQuery.isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </header>

      <section aria-label="Query search" className="rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="queries-search">Search saved queries</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="queries-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by name or path…"
              className="touch-target h-11 pl-9"
            />
          </div>
        </div>
      </section>

      {listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load queries</AlertTitle>
          <AlertDescription>
            {listQuery.error instanceof Error
              ? listQuery.error.message
              : 'Something went wrong loading the query hierarchy.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <section aria-label="Saved queries" className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Library</h2>
            <p className="text-xs text-muted-foreground">My Queries and Shared Queries</p>
          </div>

          {listQuery.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-5/6" />
              <Skeleton className="h-8 w-4/5" />
            </div>
          ) : showSearchResults ? (
            <ScrollArea className="h-[min(28rem,50vh)]">
              <ul className="space-y-1 p-2" role="listbox" aria-label="Matching queries">
                {searchable.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No queries match that search.
                  </li>
                ) : (
                  searchable.map(({ item, depth }) => (
                    <li key={item.id}>
                      <QueryRow
                        item={item}
                        depth={depth}
                        selected={selectedId === item.id}
                        expanded={false}
                        loading={false}
                        onSelect={() => selectQuery(item)}
                        onToggle={() => selectQuery(item)}
                      />
                    </li>
                  ))
                )}
              </ul>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[min(28rem,50vh)]">
              <QueryTree
                nodes={roots}
                depth={0}
                selectedId={selectedId}
                expandedIds={resolvedExpanded}
                loadingFolderId={loadingFolderId}
                onSelect={selectQuery}
                onToggle={(folder) => void onExpandFolder(folder)}
              />
            </ScrollArea>
          )}
        </section>

        <section aria-label="Query details" className="flex flex-col gap-4">
          {!selectedId ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
              <FileSearch className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Select a query</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Choose a saved query to preview its WIQL and run it against this project.
              </p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detailQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load query</AlertTitle>
              <AlertDescription>
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : 'Something went wrong loading this query.'}
              </AlertDescription>
            </Alert>
          ) : selectedQuery ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {selectedQuery.name}
                    </h2>
                    {selectedQuery.queryType ? (
                      <Badge variant="secondary">{selectedQuery.queryType}</Badge>
                    ) : null}
                    {selectedQuery.isPublic != null ? (
                      <Badge variant="outline">
                        {selectedQuery.isPublic ? 'Shared' : 'Personal'}
                      </Badge>
                    ) : null}
                  </div>
                  {selectedQuery.path ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {selectedQuery.path}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  className="touch-target h-11 shrink-0 gap-2"
                  disabled={!canRun || runQuery.isFetching}
                  onClick={onRun}
                >
                  <Play
                    className={cn('size-4', runQuery.isFetching && 'animate-pulse')}
                  />
                  {runQuery.isFetching ? 'Running…' : 'Run query'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="query-wiql">WIQL</Label>
                <ScrollArea className="h-40 rounded-md border border-border bg-muted/20">
                  <pre
                    id="query-wiql"
                    className="p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
                  >
                    {selectedQuery.wiql?.trim() || 'No WIQL available for this item.'}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          ) : null}

          {runToken > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Results</h3>
                  <p className="text-sm text-muted-foreground">
                    {runQuery.isFetching
                      ? 'Running query…'
                      : runQuery.isError
                        ? 'Run failed'
                        : `${results.length} work item${results.length === 1 ? '' : 's'}${
                            runQuery.data?.truncated ? ` (first ${RUN_TOP})` : ''
                          }`}
                  </p>
                </div>
                {pageCount > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="touch-target"
                      disabled={safePage <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {safePage + 1} / {pageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="touch-target"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>

              {runQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Could not run query</AlertTitle>
                  <AlertDescription>
                    {runQuery.error instanceof Error
                      ? runQuery.error.message
                      : 'Something went wrong running this query.'}
                  </AlertDescription>
                </Alert>
              ) : runQuery.isFetching ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                </div>
              ) : results.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No work items matched this query.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pageItems.map((item) => (
                    <li key={item.id}>
                      <WorkItemListCard
                        item={item}
                        onOpen={() => {
                          if (item.id == null) return;
                          setDetailId(item.id);
                          setDetailOpen(true);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>

      <WorkItemDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        workItemId={detailId}
        project={project}
        people={[]}
        iterations={[]}
        onChanged={() => {
          if (runToken > 0) {
            void queryClient.invalidateQueries({
              queryKey: adoQueryKeys.queries.run(organization, project, selectedId ?? ''),
            });
          }
        }}
      />
    </div>
  );
}

function QueryTree({
  nodes,
  depth,
  selectedId,
  expandedIds,
  loadingFolderId,
  onSelect,
  onToggle,
}: {
  nodes: QueryHierarchyItem[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  loadingFolderId: string | null;
  onSelect: (item: QueryHierarchyItem) => void;
  onToggle: (folder: QueryHierarchyItem) => void;
}) {
  if (nodes.length === 0 && depth === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No saved queries in this project.
      </p>
    );
  }

  return (
    <ul
      className={cn('space-y-0.5 p-2', depth > 0 && 'pl-2')}
      role={depth === 0 ? 'tree' : 'group'}
    >
      {nodes.map((item) => {
        const isFolder = Boolean(item.isFolder);
        const expanded = expandedIds.has(item.id);
        const children = item.children ?? [];

        return (
          <li
            key={item.id}
            role="treeitem"
            aria-expanded={isFolder ? expanded : undefined}
            aria-selected={selectedId === item.id}
          >
            <QueryRow
              item={item}
              depth={depth}
              selected={selectedId === item.id}
              expanded={expanded}
              loading={loadingFolderId === item.id}
              onSelect={() => onSelect(item)}
              onToggle={() => onToggle(item)}
            />
            {isFolder && expanded && children.length > 0 ? (
              <QueryTree
                nodes={children}
                depth={depth + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                loadingFolderId={loadingFolderId}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ) : null}
            {isFolder &&
            expanded &&
            children.length === 0 &&
            item.hasChildren &&
            loadingFolderId === item.id ? (
              <p className="px-4 py-2 text-xs text-muted-foreground">Loading…</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function QueryRow({
  item,
  depth,
  selected,
  expanded,
  loading,
  onSelect,
  onToggle,
}: {
  item: QueryHierarchyItem;
  depth: number;
  selected: boolean;
  expanded: boolean;
  loading: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const isFolder = Boolean(item.isFolder);

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md',
        selected && !isFolder && 'bg-muted',
      )}
      style={{ paddingLeft: `${depth * 0.75}rem` }}
    >
      {isFolder ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
          aria-expanded={expanded}
          disabled={loading}
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
      ) : (
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center"
          aria-hidden
        >
          <FileSearch className="size-4 text-muted-foreground" />
        </span>
      )}
      <button
        type="button"
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          selected && !isFolder && 'font-medium',
        )}
        onClick={onSelect}
      >
        {isFolder ? (
          <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <span className="truncate">{item.name}</span>
        {!isFolder && item.queryType ? (
          <Badge variant="outline" className="ml-auto shrink-0 text-[0.65rem]">
            {item.queryType}
          </Badge>
        ) : null}
      </button>
    </div>
  );
}

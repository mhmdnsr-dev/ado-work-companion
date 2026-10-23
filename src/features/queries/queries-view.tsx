'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Folder,
  FolderKanban,
  Link2,
  List,
  ListTree,
  Loader2,
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
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const selectedId = searchParams.get('query');
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);
  const [folderChildren, setFolderChildren] = useState<
    Record<string, QueryHierarchyItem[]>
  >({});
  const [runToken, setRunToken] = useState(0);
  const [page, setPage] = useState(0);
  const itemParam = searchParams.get('item');
  const detailId = itemParam && /^\d+$/.test(itemParam) ? Number(itemParam) : null;
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
    // Opening a query runs it: results are why people open one.
    enabled: Boolean(api && project && selectedId && canRun),
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
    const next = new URLSearchParams(searchParams.toString());
    next.set('query', item.id);
    next.delete('item');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
    setRunToken(0);
    setPage(0);
  }

  function onRerun() {
    if (!canRun || !selectedId) return;
    setPage(0);
    setRunToken((token) => token + 1);
  }

  function refreshLibrary() {
    setFolderChildren({});
    setExpandedIds(null);
    void listQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: adoQueryKeys.queries.all });
  }

  function openWorkItem(id: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('item', String(id));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function closeWorkItem() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('item');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
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
              <Link href="/settings">Open Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <header className="hidden flex-col gap-3 md:flex md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Queries</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Run saved queries in{' '}
            <span className="font-medium text-foreground">{project}</span>.
          </p>
        </div>
      </header>

      {/* Phones show the library or the open query; lg shows both side by side. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section
          aria-label="Saved queries"
          className={cn('flex flex-col gap-3', selectedId && 'hidden lg:flex')}
        >
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="queries-search"
                type="search"
                enterKeyHint="search"
                aria-label="Search saved queries"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search saved queries"
                className="touch-target h-11 ps-9"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="touch-target size-11 shrink-0 text-muted-foreground"
              aria-label="Refresh queries"
              title="Refresh queries"
              disabled={listQuery.isFetching}
              onClick={refreshLibrary}
            >
              <RefreshCw
                className={cn('size-4', listQuery.isFetching && 'animate-spin')}
              />
            </Button>
          </form>

          {listQuery.isError ? (
            <ErrorState
              title="Could not load queries"
              error={listQuery.error}
              onRetry={refreshLibrary}
              retrying={listQuery.isFetching}
            />
          ) : listQuery.isLoading ? (
            <RowsSkeleton rows={5} />
          ) : roots.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No saved queries"
              description="Create queries in Azure DevOps (My Queries or Shared Queries) and they show up here."
            />
          ) : showSearchResults && searchable.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No queries match"
              description={`Nothing named or filed under “${search.trim()}”.`}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target h-11"
                  onClick={() => setSearch('')}
                >
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="-mx-4 overflow-hidden border-y border-border bg-card md:mx-0 md:rounded-lg md:border">
              {showSearchResults ? (
                <ul role="list" aria-label="Matching queries" className="flex flex-col">
                  {searchable.map(({ item }) => (
                    <li key={item.id}>
                      <QueryRow
                        item={item}
                        depth={0}
                        selected={selectedId === item.id}
                        expanded={false}
                        loading={false}
                        showPath
                        onActivate={() => selectQuery(item)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <QueryTree
                  nodes={roots}
                  depth={0}
                  selectedId={selectedId}
                  expandedIds={resolvedExpanded}
                  loadingFolderId={loadingFolderId}
                  onSelect={selectQuery}
                  onToggle={(folder) => void onExpandFolder(folder)}
                />
              )}
            </div>
          )}
        </section>

        <section
          aria-label="Query details"
          className={cn('flex flex-col gap-4', !selectedId && 'hidden lg:flex')}
        >
          {!selectedId ? (
            <EmptyState
              icon={FileSearch}
              title="Pick a query"
              description="Its results open here. Tap a work item to update it."
            />
          ) : detailQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <RowsSkeleton rows={4} />
            </div>
          ) : detailQuery.isError ? (
            <ErrorState
              title="Could not load this query"
              error={detailQuery.error}
              onRetry={() => void detailQuery.refetch()}
              retrying={detailQuery.isFetching}
            />
          ) : selectedQuery ? (
            <>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <QueryTypeGlyph
                    type={selectedQuery.queryType}
                    className="size-4 text-muted-foreground"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg leading-snug font-semibold tracking-tight break-words">
                    {selectedQuery.name}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      selectedQuery.isPublic == null
                        ? null
                        : selectedQuery.isPublic
                          ? 'Shared'
                          : 'Personal',
                      selectedQuery.path,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="touch-target size-11 shrink-0 text-muted-foreground"
                  aria-label="Run again"
                  title="Run again"
                  disabled={!canRun || runQuery.isFetching}
                  onClick={onRerun}
                >
                  <RefreshCw
                    className={cn('size-4', runQuery.isFetching && 'animate-spin')}
                  />
                </Button>
              </div>

              {canRun ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      {runQuery.isFetching && !runQuery.data
                        ? 'Running…'
                        : runQuery.isError
                          ? 'Run failed'
                          : `${results.length} work item${results.length === 1 ? '' : 's'}${
                              runQuery.data?.truncated ? ` (first ${RUN_TOP})` : ''
                            }`}
                    </p>
                    {pageCount > 1 ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="touch-target size-10"
                          aria-label="Previous page"
                          disabled={safePage <= 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {safePage + 1}/{pageCount}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="touch-target size-10"
                          aria-label="Next page"
                          disabled={safePage >= pageCount - 1}
                          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {runQuery.isError ? (
                    <ErrorState
                      title="Could not run this query"
                      error={runQuery.error}
                      onRetry={onRerun}
                      retrying={runQuery.isFetching}
                    />
                  ) : runQuery.isLoading ? (
                    <RowsSkeleton rows={4} />
                  ) : results.length === 0 ? (
                    <EmptyState
                      icon={FileSearch}
                      title="No matching work items"
                      description="This query returns nothing in the project right now."
                    />
                  ) : (
                    <WorkItemTree
                      label="Query results"
                      roots={toFlatNodes(pageItems)}
                      onOpen={openWorkItem}
                      selectedId={detailId}
                      className={cn(runQuery.isFetching && 'opacity-60')}
                    />
                  )}
                </div>
              ) : null}

              <details className="group rounded-lg border border-border">
                <summary className="touch-target flex cursor-pointer items-center gap-2 px-3 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronRight
                    className="size-4 transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  Show WIQL
                </summary>
                <pre className="overflow-x-auto border-t border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
                  {selectedQuery.wiql?.trim() || 'No WIQL available for this item.'}
                </pre>
              </details>
            </>
          ) : null}
        </section>
      </div>

      <WorkItemDetailSheet
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) closeWorkItem();
        }}
        workItemId={detailId}
        project={project}
        people={[]}
        iterations={[]}
        onChanged={() => {
          void queryClient.invalidateQueries({
            queryKey: adoQueryKeys.queries.run(organization, project, selectedId ?? ''),
          });
        }}
      />
    </div>
  );
}

/** Flat, tree, and direct-links queries read differently, so their glyphs differ. */
function QueryTypeGlyph({ type, className }: { type?: string; className?: string }) {
  if (type === 'tree') return <ListTree className={className} aria-hidden />;
  if (type === 'oneHop') return <Link2 className={className} aria-hidden />;
  return <List className={className} aria-hidden />;
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
  return (
    <ul
      role={depth === 0 ? 'tree' : 'group'}
      aria-label={depth === 0 ? 'Saved queries' : undefined}
      className="flex flex-col"
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
              onActivate={() => (isFolder ? onToggle(item) : onSelect(item))}
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
          </li>
        );
      })}
    </ul>
  );
}

/** One 44px row per folder or query; the whole row is the target. */
function QueryRow({
  item,
  depth,
  selected,
  expanded,
  loading,
  showPath = false,
  onActivate,
}: {
  item: QueryHierarchyItem;
  depth: number;
  selected: boolean;
  expanded: boolean;
  loading: boolean;
  /** Search results are flat, so they show where each query lives. */
  showPath?: boolean;
  onActivate: () => void;
}) {
  const isFolder = Boolean(item.isFolder);
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={loading}
      aria-label={
        isFolder ? `${expanded ? 'Collapse' : 'Expand'} ${item.name}` : undefined
      }
      className={cn(
        'flex min-h-11 w-full items-center gap-2 border-b border-border/70 pe-4 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
        isFolder && 'font-medium',
        selected && 'bg-primary/10 shadow-[inset_3px_0_0_var(--color-primary)]',
      )}
      style={{ paddingInlineStart: 8 + depth * 16 }}
    >
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center text-muted-foreground"
      >
        {isFolder ? (
          loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ChevronRight
              className={cn('size-4 transition-transform', expanded && 'rotate-90')}
            />
          )
        ) : null}
      </span>
      {isFolder ? (
        <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <QueryTypeGlyph
          type={item.queryType}
          className="size-4 shrink-0 text-muted-foreground"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col py-2">
        <span className="truncate">{item.name}</span>
        {showPath && item.path ? (
          <span className="truncate text-xs text-muted-foreground">{item.path}</span>
        ) : null}
      </span>
    </button>
  );
}

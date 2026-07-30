'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import type { ProjectState, ProjectVisibility, TeamProjectReference } from '@core/types';
import { useConnection } from '@/components/providers';
import { RequestInspectorCard } from '@/components/shared/request-inspector';
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
import { ProjectDetailSheet } from '@/features/projects/project-detail-sheet';
import { ProjectListItem } from '@/features/projects/project-list-item';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

type StateFilter = Extract<
  ProjectState,
  'wellFormed' | 'all' | 'createPending' | 'deleted'
>;
type VisibilityFilter = 'all' | ProjectVisibility;

function filterProjects(
  projects: TeamProjectReference[],
  search: string,
  visibility: VisibilityFilter,
): TeamProjectReference[] {
  const q = search.trim().toLowerCase();
  return projects.filter((project) => {
    if (visibility !== 'all' && project.visibility !== visibility) return false;
    if (!q) return true;
    return (
      project.name.toLowerCase().includes(q) ||
      project.description?.toLowerCase().includes(q) ||
      project.id.toLowerCase().includes(q) ||
      project.abbreviation?.toLowerCase().includes(q)
    );
  });
}

export function ProjectsView() {
  const { api, settings, setActiveProject } = useConnection();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('wellFormed');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: adoQueryKeys.projects.list(settings.organization, stateFilter),
    enabled: Boolean(api && settings.organization),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Azure DevOps client is not ready.');
      return api.listProjects({
        signal,
        stateFilter,
        getDefaultTeamImageUrl: true,
      });
    },
  });

  const projects = useMemo(() => listQuery.data?.data ?? [], [listQuery.data?.data]);
  const filtered = useMemo(
    () => filterProjects(projects, search, visibilityFilter),
    [projects, search, visibilityFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const selectedProject =
    projects.find((project) => project.id === selectedId) ??
    filtered.find((project) => project.id === selectedId) ??
    null;

  async function handleSetActive(projectName: string | undefined) {
    try {
      await setActiveProject(projectName);
      toast.success(
        projectName
          ? `Active project set to ${projectName}`
          : 'Using organization scope only',
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update active project',
      );
    }
  }

  function openDetails(project: TeamProjectReference) {
    setSelectedId(project.id);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Projects</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Browse Azure DevOps projects in{' '}
          <span className="font-medium text-foreground">{settings.organization}</span>,
          inspect details, and set the active project scope.
        </p>
      </header>

      <section
        aria-label="Project filters"
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_auto]"
      >
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="projects-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="projects-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Name, description, id…"
              className="touch-target h-11 pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projects-state">State</Label>
          <Select
            value={stateFilter}
            onValueChange={(value) => {
              setStateFilter(value as StateFilter);
              setPage(0);
            }}
          >
            <SelectTrigger id="projects-state" className="touch-target h-11 w-full">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wellFormed">Well formed</SelectItem>
              <SelectItem value="all">All (except deleted)</SelectItem>
              <SelectItem value="createPending">Create pending</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projects-visibility">Visibility</Label>
          <Select
            value={visibilityFilter}
            onValueChange={(value) => {
              setVisibilityFilter(value as VisibilityFilter);
              setPage(0);
            }}
          >
            <SelectTrigger id="projects-visibility" className="touch-target h-11 w-full">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11 w-full gap-2"
            disabled={listQuery.isFetching}
            onClick={() => void listQuery.refetch()}
          >
            <RefreshCw className={cn('size-4', listQuery.isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </section>

      {listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load projects</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : 'Unexpected error loading projects.'}
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {listQuery.isLoading
            ? 'Loading projects…'
            : `${filtered.length} of ${projects.length} project${projects.length === 1 ? '' : 's'}`}
          {settings.project ? (
            <>
              {' '}
              · Active:{' '}
              <span className="font-medium text-foreground">{settings.project}</span>
            </>
          ) : (
            <> · Organization scope</>
          )}
        </p>
        {settings.project ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => void handleSetActive(undefined)}
          >
            Clear active project
          </Button>
        ) : null}
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No projects match your filters.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((project) => (
            <li key={project.id}>
              <ProjectListItem
                project={project}
                isActive={settings.project === project.name}
                onOpen={() => openDetails(project)}
                onSetActive={() => void handleSetActive(project.name)}
              />
            </li>
          ))}
        </ul>
      )}

      {filtered.length > PAGE_SIZE ? (
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

      <RequestInspectorCard
        title="List request"
        record={listQuery.data?.inspection ?? null}
      />

      <ProjectDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        projectIdOrName={selectedProject?.id ?? selectedId}
        projectName={selectedProject?.name}
        isActive={Boolean(selectedProject && settings.project === selectedProject.name)}
        onSetActive={() => {
          if (selectedProject) void handleSetActive(selectedProject.name);
        }}
      />
    </div>
  );
}

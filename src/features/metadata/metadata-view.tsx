'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { adoQueryKeys } from '@core/constants';
import { flattenClassificationPaths, identityDisplayName } from '@core/domain';
import type {
  TeamMember,
  TeamSettingsIteration,
  WebApiTeam,
  WorkItemField,
  WorkItemRelationType,
  WorkItemStateColor,
  WorkItemType,
} from '@core/types';
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
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

const SECTIONS = [
  { id: 'teams', label: 'Teams' },
  { id: 'types', label: 'Work item types' },
  { id: 'fields', label: 'Fields' },
  { id: 'areas', label: 'Areas' },
  { id: 'iterations', label: 'Iterations' },
  { id: 'links', label: 'Link types' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function matchesSearch(
  haystacks: Array<string | undefined | null>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystacks.some((value) => value?.toLowerCase().includes(q));
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function typeColorStyle(color?: string): CSSProperties | undefined {
  if (!color) return undefined;
  const hex = color.startsWith('#') ? color : `#${color}`;
  return { backgroundColor: hex };
}

export function MetadataView() {
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
    <MetadataViewContent
      key={`${organization}::${project}`}
      organization={organization}
      project={project}
    />
  );
}

function MetadataViewContent({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const { api } = useConnection();
  const [section, setSection] = useState<SectionId>('teams');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTypeName, setSelectedTypeName] = useState<string | null>(null);

  const teamsQuery = useQuery({
    queryKey: adoQueryKeys.metadata.teams(organization, project),
    enabled: Boolean(api && project && section === 'teams'),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeams({ project, signal });
    },
  });

  const typesQuery = useQuery({
    queryKey: adoQueryKeys.metadata.types(organization, project),
    enabled: Boolean(api && project && section === 'types'),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemTypes({ project, signal });
    },
  });

  const fieldsQuery = useQuery({
    queryKey: adoQueryKeys.metadata.fields(organization, project),
    enabled: Boolean(api && project && section === 'fields'),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemFields({ project, signal });
    },
  });

  const areasQuery = useQuery({
    queryKey: adoQueryKeys.metadata.classification(organization, project, 'areas'),
    enabled: Boolean(api && project && section === 'areas'),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getClassificationNode({
        project,
        structureGroup: 'areas',
        depth: 10,
        signal,
      });
    },
  });

  const iterationsQuery = useQuery({
    queryKey: adoQueryKeys.metadata.classification(organization, project, 'iterations'),
    enabled: Boolean(api && project && section === 'iterations'),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getClassificationNode({
        project,
        structureGroup: 'iterations',
        depth: 10,
        signal,
      });
    },
  });

  const linksQuery = useQuery({
    queryKey: adoQueryKeys.metadata.relationTypes(organization),
    enabled: Boolean(api && section === 'links'),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemRelationTypes({ signal });
    },
  });

  const selectedTeam =
    teamsQuery.data?.data.find((team) => team.id === selectedTeamId) ?? null;

  const membersQuery = useQuery({
    queryKey: adoQueryKeys.metadata.members(
      organization,
      project,
      selectedTeam?.name ?? '',
    ),
    enabled: Boolean(api && project && selectedTeam?.name && section === 'teams'),
    queryFn: async ({ signal }) => {
      if (!api || !selectedTeam?.name) throw new Error('Connection is not ready.');
      return api.listTeamMembers({
        project,
        team: selectedTeam.name,
        signal,
      });
    },
  });

  const teamIterationsQuery = useQuery({
    queryKey: adoQueryKeys.metadata.teamIterations(
      organization,
      project,
      selectedTeam?.name ?? '',
    ),
    enabled: Boolean(api && project && selectedTeam?.name && section === 'teams'),
    queryFn: async ({ signal }) => {
      if (!api || !selectedTeam?.name) throw new Error('Connection is not ready.');
      return api.listTeamIterations({
        project,
        team: selectedTeam.name,
        signal,
      });
    },
  });

  const statesQuery = useQuery({
    queryKey: adoQueryKeys.metadata.states(organization, project, selectedTypeName ?? ''),
    enabled: Boolean(api && project && selectedTypeName && section === 'types'),
    queryFn: async ({ signal }) => {
      if (!api || !selectedTypeName) throw new Error('Connection is not ready.');
      return api.listWorkItemTypeStates({
        project,
        type: selectedTypeName,
        signal,
      });
    },
  });

  const activeQuery = {
    teams: teamsQuery,
    types: typesQuery,
    fields: fieldsQuery,
    areas: areasQuery,
    iterations: iterationsQuery,
    links: linksQuery,
  }[section];

  const filteredTeams = useMemo(() => {
    const items = teamsQuery.data?.data ?? [];
    return items.filter((team) =>
      matchesSearch([team.name, team.description, team.id], search),
    );
  }, [teamsQuery.data?.data, search]);

  const filteredTypes = useMemo(() => {
    const items = typesQuery.data?.data ?? [];
    return items.filter((type) =>
      matchesSearch([type.name, type.referenceName, type.description], search),
    );
  }, [typesQuery.data?.data, search]);

  const filteredFields = useMemo(() => {
    const items = fieldsQuery.data?.data ?? [];
    return items.filter((field) =>
      matchesSearch(
        [field.name, field.referenceName, field.description, field.type],
        search,
      ),
    );
  }, [fieldsQuery.data?.data, search]);

  const filteredAreas = useMemo(() => {
    const paths = flattenClassificationPaths(areasQuery.data?.data);
    return paths.filter((item) => matchesSearch([item.name, item.path], search));
  }, [areasQuery.data?.data, search]);

  const filteredIterations = useMemo(() => {
    const paths = flattenClassificationPaths(iterationsQuery.data?.data);
    return paths.filter((item) => matchesSearch([item.name, item.path], search));
  }, [iterationsQuery.data?.data, search]);

  const filteredLinks = useMemo(() => {
    const items = linksQuery.data?.data ?? [];
    return items.filter((link) =>
      matchesSearch(
        [
          link.name,
          link.referenceName,
          link.attributes?.usage,
          link.attributes?.topology,
        ],
        search,
      ),
    );
  }, [linksQuery.data?.data, search]);

  const listLength = {
    teams: filteredTeams.length,
    types: filteredTypes.length,
    fields: filteredFields.length,
    areas: filteredAreas.length,
    iterations: filteredIterations.length,
    links: filteredLinks.length,
  }[section];

  const pageCount = Math.max(1, Math.ceil(listLength / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rangeStart = safePage * PAGE_SIZE;
  const rangeEnd = rangeStart + PAGE_SIZE;

  function changeSection(next: SectionId) {
    setSection(next);
    setSearch('');
    setPage(0);
    setSelectedTeamId(null);
    setSelectedTypeName(null);
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Metadata</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Browse teams, types, fields, and classification paths for a project.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Project metadata is scoped to a team project. Pick one to inspect process
              details.
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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Metadata</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Inspect process and structure details for{' '}
            <span className="font-medium text-foreground">{project}</span>.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="touch-target h-11 gap-2"
          disabled={activeQuery.isFetching}
          onClick={() => void activeQuery.refetch()}
        >
          <RefreshCw className={cn('size-4', activeQuery.isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </header>

      <section
        aria-label="Metadata filters"
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.4fr)]"
      >
        <div className="space-y-2">
          <Label htmlFor="metadata-section">Section</Label>
          <Select
            value={section}
            onValueChange={(value) => changeSection(value as SectionId)}
          >
            <SelectTrigger id="metadata-section" className="touch-target h-11 w-full">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="metadata-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="metadata-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Filter by name or reference…"
              className="touch-target h-11 pl-9"
            />
          </div>
        </div>
      </section>

      {activeQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load metadata</AlertTitle>
          <AlertDescription>
            {activeQuery.error instanceof Error
              ? activeQuery.error.message
              : 'Something went wrong loading this section.'}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {activeQuery.isLoading
            ? 'Loading…'
            : `${listLength} item${listLength === 1 ? '' : 's'}`}
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-target"
              disabled={safePage <= 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft className="size-4" />
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
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {activeQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {section === 'teams' ? (
            <TeamsSection
              teams={filteredTeams.slice(rangeStart, rangeEnd)}
              selectedTeamId={selectedTeamId}
              onSelect={(team) =>
                setSelectedTeamId((current) => (current === team.id ? null : team.id))
              }
              selectedTeam={selectedTeam}
              members={membersQuery.data?.data ?? []}
              membersLoading={membersQuery.isLoading}
              membersError={membersQuery.isError}
              iterations={teamIterationsQuery.data?.data ?? []}
              iterationsLoading={teamIterationsQuery.isLoading}
              iterationsError={teamIterationsQuery.isError}
            />
          ) : null}

          {section === 'types' ? (
            <TypesSection
              types={filteredTypes.slice(rangeStart, rangeEnd)}
              selectedTypeName={selectedTypeName}
              onSelect={(type) =>
                setSelectedTypeName((current) =>
                  current === type.name ? null : type.name,
                )
              }
              states={statesQuery.data?.data ?? []}
              statesLoading={statesQuery.isLoading}
              statesError={statesQuery.isError}
            />
          ) : null}

          {section === 'fields' ? (
            <FieldsSection fields={filteredFields.slice(rangeStart, rangeEnd)} />
          ) : null}

          {section === 'areas' ? (
            <PathsSection
              emptyLabel="No area paths in this project."
              paths={filteredAreas.slice(rangeStart, rangeEnd)}
            />
          ) : null}

          {section === 'iterations' ? (
            <PathsSection
              emptyLabel="No iteration paths in this project."
              paths={filteredIterations.slice(rangeStart, rangeEnd)}
            />
          ) : null}

          {section === 'links' ? (
            <LinksSection links={filteredLinks.slice(rangeStart, rangeEnd)} />
          ) : null}
        </>
      )}
    </div>
  );
}

function TeamsSection({
  teams,
  selectedTeamId,
  onSelect,
  selectedTeam,
  members,
  membersLoading,
  membersError,
  iterations,
  iterationsLoading,
  iterationsError,
}: {
  teams: WebApiTeam[];
  selectedTeamId: string | null;
  onSelect: (team: WebApiTeam) => void;
  selectedTeam: WebApiTeam | null;
  members: TeamMember[];
  membersLoading: boolean;
  membersError: boolean;
  iterations: TeamSettingsIteration[];
  iterationsLoading: boolean;
  iterationsError: boolean;
}) {
  if (teams.length === 0) {
    return <EmptyState message="No teams match that search." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <ul className="space-y-3">
        {teams.map((team) => {
          const selected = selectedTeamId === team.id;
          return (
            <li key={team.id}>
              <button
                type="button"
                aria-pressed={selected}
                className={cn(
                  'flex w-full flex-col gap-3 rounded-xl border bg-card py-4 text-left text-card-foreground shadow-sm transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selected && 'border-primary/50 bg-primary/5',
                )}
                onClick={() => onSelect(team)}
              >
                <div className="flex flex-col gap-1 px-4">
                  <div className="text-base leading-snug font-semibold">{team.name}</div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {team.description?.trim() || 'No description'}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="rounded-lg border border-border p-4">
        {!selectedTeam ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <Users className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Select a team</p>
            <p className="text-sm text-muted-foreground">
              View members and team iterations.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                {selectedTeam.name}
              </h2>
              <p className="text-sm text-muted-foreground">Team details</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Members</h3>
              {membersLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : membersError ? (
                <p className="text-sm text-destructive">Could not load members.</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members returned.</p>
              ) : (
                <ul className="space-y-1">
                  {members.slice(0, 12).map((member, index) => (
                    <li
                      key={
                        member.identity?.id ?? `${member.identity?.uniqueName}-${index}`
                      }
                      className="truncate text-sm"
                    >
                      {identityDisplayName(member.identity) ||
                        member.identity?.uniqueName ||
                        'Unknown'}
                      {member.isTeamAdmin ? (
                        <Badge variant="outline" className="ml-2">
                          Admin
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                  {members.length > 12 ? (
                    <li className="text-xs text-muted-foreground">
                      +{members.length - 12} more
                    </li>
                  ) : null}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Iterations</h3>
              {iterationsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : iterationsError ? (
                <p className="text-sm text-destructive">Could not load iterations.</p>
              ) : iterations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team iterations.</p>
              ) : (
                <ul className="space-y-2">
                  {iterations.slice(0, 8).map((iteration) => (
                    <li key={iteration.id} className="text-sm">
                      <div className="font-medium">{iteration.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          iteration.attributes?.timeFrame,
                          formatDate(iteration.attributes?.startDate),
                          formatDate(iteration.attributes?.finishDate)
                            ? `→ ${formatDate(iteration.attributes?.finishDate)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function TypesSection({
  types,
  selectedTypeName,
  onSelect,
  states,
  statesLoading,
  statesError,
}: {
  types: WorkItemType[];
  selectedTypeName: string | null;
  onSelect: (type: WorkItemType) => void;
  states: WorkItemStateColor[];
  statesLoading: boolean;
  statesError: boolean;
}) {
  if (types.length === 0) {
    return <EmptyState message="No work item types match that search." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <ul className="space-y-3">
        {types.map((type) => {
          const selected = selectedTypeName === type.name;
          return (
            <li key={type.name}>
              <button
                type="button"
                aria-pressed={selected}
                className={cn(
                  'flex w-full flex-col gap-3 rounded-xl border bg-card py-4 text-left text-card-foreground shadow-sm transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selected && 'border-primary/50 bg-primary/5',
                )}
                onClick={() => onSelect(type)}
              >
                <div className="flex flex-col gap-2 px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-block size-3 rounded-full border border-border"
                      style={typeColorStyle(type.color)}
                      aria-hidden
                    />
                    <div className="text-base leading-snug font-semibold">
                      {type.name}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {type.description?.trim() || type.referenceName || 'No description'}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <aside className="rounded-lg border border-border p-4">
        {!selectedTypeName ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Select a type to see its states.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">{selectedTypeName}</h2>
            <h3 className="text-sm font-medium">States</h3>
            {statesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : statesError ? (
              <p className="text-sm text-destructive">Could not load states.</p>
            ) : states.length === 0 ? (
              <p className="text-sm text-muted-foreground">No states returned.</p>
            ) : (
              <ul className="space-y-2">
                {states.map((state) => (
                  <li key={state.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block size-3 rounded-full border border-border"
                      style={typeColorStyle(state.color)}
                      aria-hidden
                    />
                    <span>{state.name}</span>
                    {state.category ? (
                      <Badge variant="outline" className="ml-auto">
                        {state.category}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function FieldsSection({ fields }: { fields: WorkItemField[] }) {
  if (fields.length === 0) {
    return <EmptyState message="No fields match that search." />;
  }

  return (
    <ul className="space-y-3">
      {fields.map((field) => (
        <li key={field.referenceName}>
          <Card className="gap-3 py-4">
            <CardHeader className="gap-2 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{field.name}</CardTitle>
                {field.type ? <Badge variant="secondary">{field.type}</Badge> : null}
                {field.readOnly ? <Badge variant="outline">Read-only</Badge> : null}
                {field.isIdentity ? <Badge variant="outline">Identity</Badge> : null}
                {field.isPicklist ? <Badge variant="outline">Picklist</Badge> : null}
              </div>
              <CardDescription className="font-mono text-xs break-all">
                {field.referenceName}
              </CardDescription>
            </CardHeader>
            {field.description ? (
              <CardContent className="px-4 pt-0">
                <p className="text-sm text-muted-foreground">{field.description}</p>
              </CardContent>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function PathsSection({
  paths,
  emptyLabel,
}: {
  paths: Array<{ path: string; name: string }>;
  emptyLabel: string;
}) {
  if (paths.length === 0) {
    return <EmptyState message={emptyLabel} />;
  }

  return (
    <ul className="space-y-2">
      {paths.map((item) => {
        const depth = Math.max(0, item.path.split('\\').length - 1);
        return (
          <li key={item.path}>
            <div
              className="rounded-md border border-border px-3 py-2 text-sm"
              style={{ marginLeft: `${Math.min(depth, 6) * 0.75}rem` }}
            >
              <div className="font-medium">
                {item.path.split('\\').pop() ?? item.name}
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {item.path}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LinksSection({ links }: { links: WorkItemRelationType[] }) {
  if (links.length === 0) {
    return <EmptyState message="No link types match that search." />;
  }

  return (
    <ul className="space-y-3">
      {links.map((link) => (
        <li key={link.referenceName}>
          <Card className="gap-3 py-4">
            <CardHeader className="gap-2 px-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{link.name}</CardTitle>
                {link.attributes?.usage ? (
                  <Badge variant="secondary">{link.attributes.usage}</Badge>
                ) : null}
                {link.attributes?.topology ? (
                  <Badge variant="outline">{link.attributes.topology}</Badge>
                ) : null}
                {link.attributes?.enabled === false ? (
                  <Badge variant="outline">Disabled</Badge>
                ) : null}
              </div>
              <CardDescription className="font-mono text-xs break-all">
                {link.referenceName}
              </CardDescription>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

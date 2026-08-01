'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Dices,
  ExternalLink,
  FolderKanban,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import { fieldNumber, fieldString } from '@core/domain';
import type { WorkItem } from '@core/types';
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

const FIBONACCI = [0, 0.5, 1, 2, 3, 5, 8, 13, 21] as const;
const ESTIMATE_FIELDS = [
  {
    value: 'Microsoft.VSTS.Scheduling.StoryPoints',
    label: 'Story Points',
  },
  {
    value: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
    label: 'Original Estimate (hours)',
  },
  {
    value: 'Microsoft.VSTS.Scheduling.Effort',
    label: 'Effort',
  },
] as const;

type EstimateField = (typeof ESTIMATE_FIELDS)[number]['value'];
type SessionPhase = 'setup' | 'voting' | 'done';

function buildEstimateHubUrl(organization: string, project: string): string {
  const org = encodeURIComponent(organization.trim());
  const proj = encodeURIComponent(project.trim());
  return `https://dev.azure.com/${org}/${proj}/_apps/hub/ms-devlabs.estimate.estimate-hub#/`;
}

function parseIds(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((part) => part.trim())
        .filter((part) => /^\d+$/.test(part))
        .map(Number)
        .filter((id) => id > 0),
    ),
  ];
}

function parseVoters(raw: string): string[] {
  const names = raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return names.length > 0 ? [...new Set(names)] : ['You'];
}

function consensus(votes: Array<number | null>): number | null {
  const numbers = votes.filter((v): v is number => v != null);
  if (numbers.length === 0) return null;
  const counts = new Map<number, number>();
  for (const value of numbers) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = numbers[0]!;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
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
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [teamName, setTeamName] = useState('');
  const [iterationId, setIterationId] = useState('');
  const [idsInput, setIdsInput] = useState('');
  const [votersInput, setVotersInput] = useState('You');
  const [estimateField, setEstimateField] =
    useState<EstimateField>('Microsoft.VSTS.Scheduling.StoryPoints');
  const [items, setItems] = useState<WorkItem[]>([]);
  const [voters, setVoters] = useState<string[]>(['You']);
  const [index, setIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, number | null>>({});
  const [revealed, setRevealed] = useState(false);
  const [appliedValue, setAppliedValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const teamsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.teams(organization, project),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeams({ project, signal });
    },
  });

  const teams = teamsQuery.data?.data ?? [];
  const resolvedTeam =
    teamName && teams.some((team) => team.name === teamName)
      ? teamName
      : (teams[0]?.name ?? '');

  const iterationsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.iterations(
      organization,
      project,
      resolvedTeam,
    ),
    enabled: Boolean(api && project && resolvedTeam),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listTeamIterations({
        project,
        team: resolvedTeam,
        signal,
      });
    },
  });

  const iterations = iterationsQuery.data?.data ?? [];
  const currentItem = items[index] ?? null;
  const hubUrl =
    organization && project ? buildEstimateHubUrl(organization, project) : null;

  const currentFieldValue = useMemo(() => {
    if (!currentItem) return null;
    return fieldNumber(currentItem, estimateField);
  }, [currentItem, estimateField]);

  const suggested = useMemo(
    () => consensus(voters.map((name) => votes[name] ?? null)),
    [voters, votes],
  );

  function resetVotes(nextVoters = voters) {
    const blank: Record<string, number | null> = {};
    for (const name of nextVoters) blank[name] = null;
    setVotes(blank);
    setRevealed(false);
    setAppliedValue('');
  }

  async function loadFromIteration() {
    if (!api || !project || !resolvedTeam || !iterationId) {
      toast.error('Pick a team and iteration first.');
      return;
    }
    setLoadingItems(true);
    try {
      const links = await api.getIterationWorkItems({
        project,
        team: resolvedTeam,
        iterationId,
      });
      const ids = (links.data.workItemRelations ?? [])
        .map((relation) => relation.target?.id)
        .filter((id): id is number => typeof id === 'number' && id > 0);
      if (ids.length === 0) {
        toast.message('No work items in that iteration.');
        return;
      }
      const batches: WorkItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const batch = await api.getWorkItems({ ids: slice, project });
        batches.push(...batch.data);
      }
      startSession(batches);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load iteration work items',
      );
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadFromIds() {
    if (!api || !project) return;
    const ids = parseIds(idsInput);
    if (ids.length === 0) {
      toast.error('Enter at least one numeric work item ID.');
      return;
    }
    setLoadingItems(true);
    try {
      const batches: WorkItem[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const batch = await api.getWorkItems({ ids: slice, project });
        batches.push(...batch.data);
      }
      if (batches.length === 0) {
        toast.message('No work items found for those IDs.');
        return;
      }
      startSession(batches);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load work items');
    } finally {
      setLoadingItems(false);
    }
  }

  function startSession(nextItems: WorkItem[]) {
    const nextVoters = parseVoters(votersInput);
    setItems(nextItems);
    setVoters(nextVoters);
    setIndex(0);
    resetVotes(nextVoters);
    setPhase('voting');
    toast.success(
      `Estimate session ready — ${nextItems.length} work item${nextItems.length === 1 ? '' : 's'}`,
    );
  }

  function goToIndex(next: number) {
    setIndex(next);
    resetVotes();
    const item = items[next];
    if (item) {
      const existing = fieldNumber(item, estimateField);
      setAppliedValue(existing == null ? '' : String(existing));
    }
  }

  async function applyEstimate() {
    if (!api || !currentItem || !project) return;
    const workItemId = currentItem.id;
    if (workItemId == null) {
      toast.error('This work item has no id.');
      return;
    }
    const raw = appliedValue.trim() || (suggested != null ? String(suggested) : '');
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a valid estimate value.');
      return;
    }

    setSaving(true);
    try {
      await api.updateWorkItem({
        id: workItemId,
        project,
        operations: [
          {
            op: 'add',
            path: `/fields/${estimateField}`,
            value,
          },
        ],
      });
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                fields: { ...item.fields, [estimateField]: value },
              }
            : item,
        ),
      );
      toast.success(`Saved ${value} on #${workItemId}`);
      if (index < items.length - 1) {
        goToIndex(index + 1);
      } else {
        setPhase('done');
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save estimate (field may not exist on this work item type)',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Estimate</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Planning poker for your backlog — pick cards, agree a value, write it back to
            Azure DevOps.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Estimate sessions are scoped to a team project.</span>
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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Estimate</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Run a lightweight planning poker session in{' '}
            <span className="font-medium text-foreground">{project}</span>, or open the
            official Azure DevOps Estimate hub for a live team room.
          </p>
        </div>
        {hubUrl ? (
          <Button asChild variant="outline" className="touch-target h-11 gap-2">
            <a href={hubUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open Estimate hub
            </a>
          </Button>
        ) : null}
      </header>

      {phase === 'setup' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-lg">Session options</CardTitle>
              <CardDescription>
                Used for both iteration and ID-based sessions on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estimate-voters">Voters (optional)</Label>
                <Input
                  id="estimate-voters"
                  value={votersInput}
                  onChange={(event) => setVotersInput(event.target.value)}
                  placeholder="You, Alex, Sam"
                  className="touch-target h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Same device — each person picks a card in turn, then reveal.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate-field">Write estimate to</Label>
                <Select
                  value={estimateField}
                  onValueChange={(value) => setEstimateField(value as EstimateField)}
                >
                  <SelectTrigger id="estimate-field" className="touch-target h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTIMATE_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-lg">From iteration</CardTitle>
              <CardDescription>
                Load work items from a team iteration (same idea as the DevLabs Estimate
                hub).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="estimate-team">Team</Label>
                <Select
                  value={resolvedTeam || undefined}
                  onValueChange={(value) => {
                    setTeamName(value);
                    setIterationId('');
                  }}
                >
                  <SelectTrigger id="estimate-team" className="touch-target h-11 w-full">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.name}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate-iteration">Iteration</Label>
                <Select
                  value={iterationId || undefined}
                  onValueChange={setIterationId}
                  disabled={!resolvedTeam || iterationsQuery.isLoading}
                >
                  <SelectTrigger
                    id="estimate-iteration"
                    className="touch-target h-11 w-full"
                  >
                    <SelectValue
                      placeholder={
                        iterationsQuery.isLoading ? 'Loading…' : 'Select iteration'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {iterations.map((iteration) => (
                      <SelectItem key={iteration.id} value={iteration.id}>
                        {iteration.name}
                        {iteration.attributes?.timeFrame
                          ? ` · ${iteration.attributes.timeFrame}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="touch-target h-11 w-full gap-2"
                disabled={loadingItems || !iterationId}
                onClick={() => void loadFromIteration()}
              >
                {loadingItems ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Dices className="size-4" />
                )}
                Start from iteration
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-lg">From work item IDs</CardTitle>
              <CardDescription>
                Paste IDs from a query or backlog selection (comma or space separated).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="estimate-ids">Work item IDs</Label>
                <Input
                  id="estimate-ids"
                  value={idsInput}
                  onChange={(event) => setIdsInput(event.target.value)}
                  placeholder="1234, 1235, 1240"
                  className="touch-target h-11"
                />
              </div>
              <Button
                type="button"
                className="touch-target h-11 w-full gap-2"
                disabled={loadingItems}
                onClick={() => void loadFromIds()}
              >
                {loadingItems ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Dices className="size-4" />
                )}
                Start from IDs
              </Button>
            </CardContent>
          </Card>
          </div>
        </div>
      ) : null}

      {phase === 'voting' && currentItem ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Item {index + 1} of {items.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="touch-target h-11 gap-2"
                onClick={() => {
                  setPhase('setup');
                  setItems([]);
                }}
              >
                <RotateCcw className="size-4" />
                End session
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">#{currentItem.id}</Badge>
                <Badge variant="secondary">
                  {fieldString(currentItem, 'System.WorkItemType') || 'Work item'}
                </Badge>
                <Badge>{fieldString(currentItem, 'System.State') || '—'}</Badge>
                {currentFieldValue != null ? (
                  <Badge variant="outline">Current: {currentFieldValue}</Badge>
                ) : null}
              </div>
              <CardTitle className="text-xl leading-snug">
                {fieldString(currentItem, 'System.Title') || 'Untitled'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {voters.map((name) => (
                <div key={name} className="space-y-2">
                  <p className="text-sm font-medium">{name}</p>
                  <div className="flex flex-wrap gap-2">
                    {FIBONACCI.map((value) => {
                      const selected = votes[name] === value;
                      return (
                        <Button
                          key={`${name}-${value}`}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          className={cn(
                            'touch-target h-11 min-w-11',
                            selected && 'ring-2 ring-ring',
                          )}
                          disabled={revealed}
                          onClick={() =>
                            setVotes((prev) => ({ ...prev, [name]: value }))
                          }
                        >
                          {value}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="touch-target h-11"
                  onClick={() => {
                    setRevealed(true);
                    if (suggested != null) setAppliedValue(String(suggested));
                  }}
                >
                  Reveal votes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target h-11"
                  onClick={() => resetVotes()}
                >
                  Clear votes
                </Button>
              </div>

              {revealed ? (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <p className="text-sm">
                    Votes:{' '}
                    {voters
                      .map((name) => `${name}: ${votes[name] ?? '—'}`)
                      .join(' · ')}
                  </p>
                  <p className="text-sm font-medium">
                    Suggested (mode): {suggested ?? '—'}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor="estimate-apply-value">Value to save</Label>
                      <Input
                        id="estimate-apply-value"
                        value={appliedValue}
                        onChange={(event) => setAppliedValue(event.target.value)}
                        className="touch-target h-11"
                        inputMode="decimal"
                      />
                    </div>
                    <Button
                      type="button"
                      className="touch-target h-11 gap-2"
                      disabled={saving}
                      onClick={() => void applyEstimate()}
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Save & next
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="touch-target size-11"
                  disabled={index <= 0}
                  onClick={() => goToIndex(index - 1)}
                  aria-label="Previous work item"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="touch-target size-11"
                  disabled={index >= items.length - 1}
                  onClick={() => goToIndex(index + 1)}
                  aria-label="Next work item"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {phase === 'done' ? (
        <Card>
          <CardHeader className="gap-1">
            <CardTitle className="text-lg">Session complete</CardTitle>
            <CardDescription>
              You walked through {items.length} work item
              {items.length === 1 ? '' : 's'}. Start another session or open the Azure
              DevOps Estimate hub for a live multiplayer room.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="touch-target h-11 gap-2"
              onClick={() => {
                setPhase('setup');
                setItems([]);
              }}
            >
              <Dices className="size-4" />
              New session
            </Button>
            {hubUrl ? (
              <Button asChild variant="outline" className="touch-target h-11 gap-2">
                <a href={hubUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open Estimate hub
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import { fieldString } from '@core/domain';
import type { EstimateChannelAction } from '@core/api/resources/estimate-polling';
import { buildEstimateHubSessionUrl } from '@core/types/estimate-hub';
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
import { cn } from '@/lib/utils';

const FIBONACCI = [0, 0.5, 1, 2, 3, 5, 8, 13, 21] as const;
const POLL_MS = 2000;

function deriveLiveState(actions: EstimateChannelAction[]) {
  let selectedWorkItemId: number | null = null;
  let revealed = false;
  const votes: Record<string, number | string> = {};

  for (const action of actions) {
    switch (action.type) {
      case 'switch':
        if (typeof action.payload === 'number') selectedWorkItemId = action.payload;
        Object.keys(votes).forEach((key) => delete votes[key]);
        revealed = false;
        break;
      case 'estimate': {
        const payload = action.payload as {
          identity?: { tfId?: string };
          card?: { identifier?: string | number };
          estimate?: number | string;
        };
        const voter = payload?.identity?.tfId || action.senderId;
        const value =
          payload?.estimate ??
          payload?.card?.identifier ??
          (typeof action.payload === 'number' ? action.payload : undefined);
        if (voter && value != null) votes[voter] = value;
        break;
      }
      case 'reveal':
        revealed = true;
        break;
      case 'snapshot': {
        const snap = action.payload as {
          selectedWorkItemId?: number;
          estimates?: Record<string, { value?: number | string } | number | string>;
          revealed?: boolean;
        };
        if (typeof snap.selectedWorkItemId === 'number') {
          selectedWorkItemId = snap.selectedWorkItemId;
        }
        if (snap.estimates) {
          for (const [key, entry] of Object.entries(snap.estimates)) {
            if (entry != null && typeof entry === 'object' && 'value' in entry) {
              if (entry.value != null) votes[key] = entry.value;
            } else if (entry != null) {
              votes[key] = entry as number | string;
            }
          }
        }
        if (typeof snap.revealed === 'boolean') revealed = snap.revealed;
        break;
      }
      default:
        break;
    }
  }

  return { selectedWorkItemId, revealed, votes };
}

export function EstimateHubLiveSession({
  organization,
  project,
  sessionId,
  onLeave,
}: {
  organization: string;
  project: string;
  sessionId: string;
  onLeave: () => void;
}) {
  const { api } = useConnection();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('You');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<string, number | string>>({});
  const [myVote, setMyVote] = useState<number | null>(null);
  const hubUrl = buildEstimateHubSessionUrl(organization, project, sessionId);

  const identityQuery = useQuery({
    queryKey: adoQueryKeys.dashboard.currentUser(organization),
    enabled: Boolean(api),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getAuthenticatedUser({ signal });
    },
  });

  useEffect(() => {
    const user = identityQuery.data?.data;
    if (!user) return;
    const id = user.id?.trim() || user.descriptor?.trim();
    if (!id) return;
    setUserId(id);
    setDisplayName(
      user.customDisplayName?.trim() ||
        user.providerDisplayName?.trim() ||
        id,
    );
  }, [identityQuery.data]);

  useEffect(() => {
    if (!api || !userId || joined) return;
    let cancelled = false;
    void (async () => {
      try {
        await api.joinEstimatePollingSession(sessionId, {
          tfId: userId,
          name: displayName,
        });
        if (!cancelled) {
          setJoined(true);
          toast.success('Joined live Estimate session (experimental)');
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not join live session — use Azure DevOps hub instead',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, userId, displayName, sessionId, joined]);

  useEffect(() => {
    if (!api || !joined) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const result = await api.getEstimatePollingDocument(sessionId);
        if (cancelled) return;
        const derived = deriveLiveState(result.data.actions ?? []);
        setSelectedWorkItemId(derived.selectedWorkItemId);
        setRevealed(derived.revealed);
        setVotes(derived.votes);
        if (userId && derived.votes[userId] != null) {
          const value = Number(derived.votes[userId]);
          if (Number.isFinite(value)) setMyVote(value);
        }
      } catch {
        // ignore transient
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, joined, sessionId, userId]);

  const workItemQuery = useQuery({
    queryKey: adoQueryKeys.workItems.detail(organization, selectedWorkItemId ?? 0),
    enabled: Boolean(api && selectedWorkItemId),
    queryFn: async ({ signal }) => {
      if (!api || !selectedWorkItemId) throw new Error('No work item');
      return api.getWorkItem({
        id: selectedWorkItemId,
        project,
        signal,
        expand: 'None',
      });
    },
  });

  const title = workItemQuery.data?.data
    ? fieldString(workItemQuery.data.data, 'System.Title')
    : null;

  const roster = useMemo(() => Object.entries(votes), [votes]);

  async function castVote(value: number) {
    if (!api || !userId || !selectedWorkItemId) {
      toast.message('Wait for the host to select a work item in the Estimate hub.');
      return;
    }
    setBusy(true);
    try {
      await api.appendEstimateChannelAction(
        sessionId,
        'estimate',
        {
          identity: { tfId: userId, name: displayName },
          workItemId: selectedWorkItemId,
          estimate: value,
          card: { identifier: value },
        },
        userId,
      );
      setMyVote(value);
      setVotes((prev) => ({ ...prev, [userId]: value }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cast vote');
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    if (!api || !userId) return;
    setBusy(true);
    try {
      await api.appendEstimateChannelAction(sessionId, 'reveal', null, userId);
      setRevealed(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reveal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Live session</h1>
          <p className="text-sm text-muted-foreground">
            Experimental — same Extension Data channel as the Estimate hub. Prefer the hub
            if anything looks out of sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="touch-target h-11 gap-2">
            <a href={hubUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open in Azure DevOps
            </a>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="touch-target h-11 gap-2"
            onClick={onLeave}
          >
            <RotateCcw className="size-4" />
            Back to list
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTitle>Experimental live mode</AlertTitle>
        <AlertDescription>
          Work item selection is driven by the host in the Estimate hub (or snapshot
          sync). Votes you cast here are written to the shared polling session document.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              #{sessionId.length > 10 ? sessionId.slice(0, 10) + '…' : sessionId}
            </Badge>
            {selectedWorkItemId ? (
              <Badge variant="secondary">WI #{selectedWorkItemId}</Badge>
            ) : (
              <Badge variant="outline">Waiting for work item</Badge>
            )}
            <Badge variant={revealed ? 'default' : 'outline'}>
              {revealed ? 'Revealed' : 'Voting'}
            </Badge>
          </div>
          <CardTitle className="text-xl">
            {title ||
              (selectedWorkItemId
                ? `Work item #${selectedWorkItemId}`
                : 'No work item selected yet')}
          </CardTitle>
          <CardDescription>
            {joined
              ? `Connected as ${displayName}`
              : 'Connecting to Estimate Extension Data…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Your vote</p>
            <div className="flex flex-wrap gap-2">
              {FIBONACCI.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={myVote === value ? 'default' : 'outline'}
                  className={cn(
                    'touch-target h-11 min-w-11',
                    myVote === value && 'ring-2 ring-ring',
                  )}
                  disabled={busy || !joined || !selectedWorkItemId || revealed}
                  onClick={() => void castVote(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Votes</p>
              <Button
                type="button"
                variant="secondary"
                className="touch-target h-11"
                disabled={busy || !joined || revealed}
                onClick={() => void reveal()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Reveal
              </Button>
            </div>
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">No votes yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {roster.map(([id, value]) => (
                  <li key={id}>
                    {id === userId ? 'You' : id.slice(0, 8)}:{' '}
                    {revealed || id === userId ? String(value) : '••••'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

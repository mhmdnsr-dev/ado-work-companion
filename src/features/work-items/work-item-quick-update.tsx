'use client';

import { useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  buildLogWorkPatches,
  buildRemainingWorkPatch,
  buildWorkItemStateLookup,
  fieldNumber,
  fieldString,
  workItemStateInfo,
} from '@core/domain';
import type { JsonPatchOperation, WorkItem, WorkItemStateColor } from '@core/types';
import { useConnection } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  STATE_DOT_CLASS,
  formatHours,
  usableStateColor,
} from '@/features/work-items/work-item-visuals';
import { cn } from '@/lib/utils';

const LOG_WORK_STEPS = [0.5, 1, 2, 4];
const STEP = 0.5;

function hasHourFields(item: WorkItem, type: string): boolean {
  const lower = type.toLowerCase();
  return (
    lower === 'task' ||
    lower === 'bug' ||
    fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork') != null ||
    fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork') != null
  );
}

/**
 * The daily actions, one tap each: change state (with undo) and log time.
 * Everything else stays in the full form below.
 */
export function WorkItemQuickUpdate({
  item,
  project,
  states,
  onUpdated,
}: {
  item: WorkItem;
  project: string;
  /** The type's states with ADO category and colour; empty while loading. */
  states: WorkItemStateColor[];
  /** Refreshes the item, its history, and the list after a save. */
  onUpdated: () => Promise<void>;
}) {
  const { api } = useConnection();
  const id = item.id;
  const type = fieldString(item, 'System.WorkItemType');
  const currentState = fieldString(item, 'System.State');
  const remaining = fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork') ?? 0;
  const completed = fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork') ?? 0;
  const [remainingDraft, setRemainingDraft] = useState(formatHours(remaining));
  const [pending, setPending] = useState<string | null>(null);
  const lookup = buildWorkItemStateLookup([{ name: type, states }]);
  const draftNumber = Number(remainingDraft);
  const remainingDirty =
    remainingDraft.trim() !== '' &&
    Number.isFinite(draftNumber) &&
    draftNumber !== remaining;

  async function patch(key: string, operations: JsonPatchOperation[]) {
    if (!api || id == null) return false;
    setPending(key);
    try {
      await api.updateWorkItem({ id, project, operations });
      await onUpdated();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update work item');
      return false;
    } finally {
      setPending(null);
    }
  }

  async function changeState(next: string) {
    if (next === currentState) return;
    const previous = currentState;
    const ok = await patch(`state:${next}`, [
      { op: 'add', path: '/fields/System.State', value: next },
    ]);
    if (!ok) return;
    toast.success(`#${id} moved to ${next}`, {
      action: {
        label: 'Undo',
        onClick: () =>
          void patch(`state:${previous}`, [
            { op: 'add', path: '/fields/System.State', value: previous },
          ]),
      },
    });
  }

  async function logWork(hours: number) {
    const result = buildLogWorkPatches(item, hours);
    const ok = await patch(`log:${hours}`, result.operations);
    if (ok) {
      toast.success(
        `Logged ${formatHours(hours)}h on #${id} · ${formatHours(result.remaining)}h remaining`,
      );
    }
  }

  async function saveRemaining() {
    const ok = await patch('remaining', buildRemainingWorkPatch(draftNumber));
    if (ok) toast.success(`Remaining set to ${formatHours(Math.max(0, draftNumber))}h`);
  }

  function stepRemaining(delta: number) {
    const base = Number.isFinite(draftNumber) ? draftNumber : remaining;
    setRemainingDraft(formatHours(Math.max(0, base + delta)));
  }

  // "Removed" takes an item off every board, so it stays in the full form only.
  const stateNames =
    states.length > 0
      ? states
          .filter((state) => state.category !== 'Removed' || state.name === currentState)
          .map((state) => state.name)
      : [currentState];
  if (!stateNames.includes(currentState) && currentState)
    stateNames.unshift(currentState);

  return (
    <section
      aria-labelledby="quick-update-heading"
      className="space-y-4 rounded-xl border border-border bg-muted/30 p-3"
    >
      <h3
        id="quick-update-heading"
        className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Quick update
      </h3>

      <div
        role="group"
        aria-label="State"
        className="-mx-3 flex scrollbar-none gap-2 overflow-x-auto px-3 py-1"
      >
        {stateNames.map((name) => {
          const info = workItemStateInfo(
            { fields: { 'System.WorkItemType': type, 'System.State': name } },
            lookup,
          );
          const color = usableStateColor(info.color);
          const current = name === currentState;
          const busy = pending === `state:${name}`;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={current}
              disabled={pending != null}
              onClick={() => void changeState(name)}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:opacity-60",
                current
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent',
              )}
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    !color && STATE_DOT_CLASS[info.category],
                  )}
                  style={color ? { backgroundColor: color } : undefined}
                />
              )}
              {name}
            </button>
          );
        })}
      </div>

      {hasHourFields(item, type) ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <label
                htmlFor="quick-remaining"
                className="block text-xs text-muted-foreground"
              >
                Remaining (h)
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="touch-target size-11"
                  aria-label={`Decrease remaining by ${STEP} hours`}
                  disabled={pending != null}
                  onClick={() => stepRemaining(-STEP)}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="quick-remaining"
                  inputMode="decimal"
                  value={remainingDraft}
                  onChange={(event) => setRemainingDraft(event.target.value)}
                  className="h-11 w-16 text-center font-mono tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="touch-target size-11"
                  aria-label={`Increase remaining by ${STEP} hours`}
                  disabled={pending != null}
                  onClick={() => stepRemaining(STEP)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Completed (h)</p>
              <p className="font-mono text-lg leading-[44px] tabular-nums">
                {formatHours(completed)}
              </p>
            </div>
          </div>

          {remainingDirty ? (
            <Button
              type="button"
              className="touch-target h-11 w-full gap-2"
              disabled={pending != null}
              onClick={() => void saveRemaining()}
            >
              {pending === 'remaining' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save remaining
            </Button>
          ) : null}

          <div className="space-y-1.5">
            <p id="log-work-label" className="text-xs text-muted-foreground">
              Log work (moves hours from Remaining to Completed)
            </p>
            <div
              role="group"
              aria-labelledby="log-work-label"
              className="grid grid-cols-4 gap-2"
            >
              {LOG_WORK_STEPS.map((hours) => (
                <Button
                  key={hours}
                  type="button"
                  variant="outline"
                  className="touch-target h-11 px-0 font-mono tabular-nums"
                  aria-label={`Log ${formatHours(hours)} hours`}
                  disabled={pending != null}
                  onClick={() => void logWork(hours)}
                >
                  {pending === `log:${hours}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    `+${formatHours(hours)}h`
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

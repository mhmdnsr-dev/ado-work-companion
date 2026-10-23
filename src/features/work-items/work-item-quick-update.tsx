'use client';

import { useState } from 'react';
import { Info, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  MAX_LOG_HOURS,
  buildRemainingWorkPatch,
  buildWorkItemStateLookup,
  fieldNumber,
  fieldString,
  parseHoursInput,
  planLogWork,
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

/** Parses a typed hours value ("2.5", "2,5"); anything invalid counts as 0. */
function parseHours(value: string): number {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

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
  // Log work is composed locally (chips and the stepper only change the amount)
  // and saved once, so 2.5h is one request, not three.
  const [amountDraft, setAmountDraft] = useState('');
  // Only shown when a log clears Remaining: "how much is still left?"
  const [remainingAfterDraft, setRemainingAfterDraft] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [remainingDraft, setRemainingDraft] = useState(formatHours(remaining));
  const [pending, setPending] = useState<string | null>(null);
  const lookup = buildWorkItemStateLookup([{ name: type, states }]);
  const amountInput = parseHoursInput(amountDraft);
  const amount = amountInput.kind === 'valid' ? amountInput.hours : 0;
  // Zero is a valid answer here ("nothing left"), so it isn't parseHoursInput.
  const remainingAfterValid =
    remainingAfterDraft.trim() === '' ||
    /^\d+([.,]\d+)?$/.test(remainingAfterDraft.trim());
  const remainingAfter =
    remainingAfterDraft.trim() === '' ? undefined : parseHours(remainingAfterDraft);
  const plan = amount > 0 ? planLogWork(item, amount, remainingAfter) : null;
  const canLog = plan != null && (!plan.clearsRemaining || remainingAfterValid);
  const doneState = states.find((state) => state.category === 'Completed')?.name;
  const isDone = workItemStateInfo(item, lookup).category === 'completed';
  const remainingTarget = parseHours(remainingDraft);
  // Only a real number may set Remaining: "abc" must not silently become 0.
  const remainingValid = /^\d+([.,]\d+)?$/.test(remainingDraft.trim());
  const remainingDirty = remainingValid && remainingTarget !== remaining;

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

  async function logWork() {
    if (!plan || !canLog) return;
    const ok = await patch('log', plan.operations);
    if (!ok) return;
    setAmountDraft('');
    setRemainingAfterDraft('');
    const message = `Logged ${formatHours(amount)}h on #${id} · ${formatHours(plan.remaining)}h remaining`;
    // Nothing left on open work: closing it is usually the next tap.
    if (plan.remaining === 0 && !isDone && doneState) {
      toast.success(message, {
        action: {
          label: `Mark as ${doneState}`,
          onClick: () => void changeState(doneState),
        },
      });
    } else {
      toast.success(message);
    }
  }

  function addToAmount(delta: number) {
    setAmountDraft(formatHours(Math.min(MAX_LOG_HOURS, Math.max(0, amount + delta))));
  }

  async function saveRemaining() {
    const ok = await patch('remaining', buildRemainingWorkPatch(remainingTarget));
    if (ok) {
      setAdjustOpen(false);
      toast.success(`Remaining set to ${formatHours(Math.max(0, remainingTarget))}h`);
    }
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
          <div className="flex items-baseline justify-between gap-3">
            <p id="log-work-label" className="text-sm font-medium">
              Log work
            </p>
            <p className="text-xs text-muted-foreground">
              Remaining{' '}
              <span className="font-mono text-foreground tabular-nums">
                {formatHours(remaining)}h
              </span>{' '}
              · Completed{' '}
              <span className="font-mono text-foreground tabular-nums">
                {formatHours(completed)}h
              </span>
            </p>
          </div>

          <div role="group" aria-labelledby="log-work-label" className="space-y-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="touch-target size-11"
                aria-label={`Log ${STEP} hours less`}
                disabled={pending != null || amount <= 0}
                onClick={() => addToAmount(-STEP)}
              >
                <Minus className="size-4" />
              </Button>
              <div className="relative min-w-0 flex-1">
                <Input
                  inputMode="decimal"
                  aria-label="Hours to log"
                  aria-invalid={amountInput.kind === 'invalid'}
                  aria-describedby={
                    amountInput.kind === 'invalid' ? 'hours-to-log-error' : undefined
                  }
                  placeholder="0"
                  value={amountDraft}
                  onChange={(event) => setAmountDraft(event.target.value)}
                  className="h-11 pe-7 text-center font-mono text-base tabular-nums"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
                >
                  h
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="touch-target size-11"
                aria-label={`Log ${STEP} hours more`}
                disabled={pending != null}
                onClick={() => addToAmount(STEP)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {LOG_WORK_STEPS.map((hours) => (
                <Button
                  key={hours}
                  type="button"
                  variant="secondary"
                  className="touch-target h-11 px-0 font-mono tabular-nums"
                  aria-label={`Add ${formatHours(hours)} hours`}
                  disabled={pending != null}
                  onClick={() => addToAmount(hours)}
                >
                  +{formatHours(hours)}h
                </Button>
              ))}
            </div>
          </div>

          {amountInput.kind === 'invalid' ? (
            <p id="hours-to-log-error" className="text-xs font-medium text-destructive">
              {amountInput.message}
            </p>
          ) : null}

          {plan?.clearsRemaining ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
              <label htmlFor="quick-remaining-after" className="min-w-0 text-xs">
                <span className="block font-medium text-foreground">Remaining after</span>
                <span className="block text-muted-foreground">
                  Change it if work is still left
                </span>
              </label>
              <Input
                id="quick-remaining-after"
                inputMode="decimal"
                placeholder="0"
                value={remainingAfterDraft}
                aria-invalid={!remainingAfterValid}
                onChange={(event) => setRemainingAfterDraft(event.target.value)}
                className="h-11 w-20 shrink-0 text-center font-mono tabular-nums"
              />
            </div>
          ) : null}

          {/* Shows both fields before saving, so nothing changes by surprise. */}
          <div
            aria-live="polite"
            className="min-h-4 space-y-1 text-xs text-muted-foreground"
          >
            {plan ? (
              <>
                <p>
                  Remaining {formatHours(remaining)} →{' '}
                  <span className="font-semibold text-foreground">
                    {formatHours(plan.remaining)}h
                  </span>{' '}
                  · Completed {formatHours(completed)} →{' '}
                  <span className="font-semibold text-foreground">
                    {formatHours(plan.completed)}h
                  </span>
                </p>
                {/* Over-runs are allowed: estimates are guesses. Say so, don't block. */}
                {plan.overRemaining > 0 ? (
                  <p className="flex items-start gap-1.5">
                    <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                    {formatHours(plan.overRemaining)}h more than the remaining estimate.
                  </p>
                ) : null}
                {plan.overEstimate > 0 && plan.originalEstimate != null ? (
                  <p className="flex items-start gap-1.5">
                    <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                    Completed goes {formatHours(plan.overEstimate)}h past the original{' '}
                    {formatHours(plan.originalEstimate)}h estimate.
                  </p>
                ) : null}
              </>
            ) : amountInput.kind === 'invalid' ? null : (
              <p>Tap the chips or type hours, then log them in one go.</p>
            )}
          </div>

          <Button
            type="button"
            className="touch-target h-11 w-full gap-2"
            disabled={!canLog || pending != null}
            onClick={() => void logWork()}
          >
            {pending === 'log' ? <Loader2 className="size-4 animate-spin" /> : null}
            {plan ? `Log ${formatHours(amount)}h` : 'Log work'}
          </Button>

          <div className="border-t border-border pt-2">
            <Button
              type="button"
              variant="link"
              className="h-11 px-0 text-sm"
              aria-expanded={adjustOpen}
              aria-controls="adjust-remaining"
              onClick={() => setAdjustOpen((open) => !open)}
            >
              Adjust remaining only
            </Button>
            {adjustOpen ? (
              <div id="adjust-remaining" className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label htmlFor="quick-remaining" className="block text-xs">
                      Set remaining to (h)
                    </label>
                    <Input
                      id="quick-remaining"
                      inputMode="decimal"
                      value={remainingDraft}
                      onChange={(event) => setRemainingDraft(event.target.value)}
                      className="h-11 font-mono tabular-nums"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="touch-target h-11 gap-2"
                    disabled={!remainingDirty || pending != null}
                    onClick={() => void saveRemaining()}
                  >
                    {pending === 'remaining' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  For re-estimates. Completed hours don’t change.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Loader2, RotateCcw, type LucideIcon } from 'lucide-react';

import { AdoClientError } from '@core/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Nothing to show: say why, and offer the one action that helps. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-1 grid size-10 place-items-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </span>
      ) : null}
      <p className="text-sm font-semibold">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** A failed load: the message, ADO's suggestions when it gives any, and Retry. */
export function ErrorState({
  title,
  error,
  onRetry,
  retrying = false,
  className,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const suggestions = error instanceof AdoClientError ? error.suggestions : [];
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{message}</p>
        {suggestions.length > 0 ? (
          <ul className="list-disc space-y-1 ps-4 text-sm">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        ) : null}
        {onRetry ? (
          <Button
            type="button"
            variant="secondary"
            className="touch-target h-11 w-fit gap-2"
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Loading placeholder shaped like tree rows, so the page doesn't jump on load. */
export function RowsSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy
      aria-label="Loading"
      className={cn(
        '-mx-4 overflow-hidden border-y border-border md:mx-0 md:rounded-lg md:border',
        className,
      )}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
        >
          <Skeleton className="size-4 rounded-sm" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${55 + ((index * 17) % 35)}%` }} />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

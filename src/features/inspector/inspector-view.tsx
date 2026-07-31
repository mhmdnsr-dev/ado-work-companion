'use client';

import { useMemo, useState } from 'react';
import { Copy, Eraser, Radar } from 'lucide-react';
import { toast } from 'sonner';

import type { RequestInspectionRecord } from '@core/types';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const deltaSec = Math.round((Date.now() - then) / 1000);
  if (deltaSec < 5) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function prettyBody(raw: string | null): string {
  if (raw == null || raw.length === 0) return '—';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusTone(status: number | null, errorMessage: string | null) {
  if (errorMessage && (status == null || status >= 400)) return 'destructive' as const;
  if (status == null) return 'secondary' as const;
  if (status >= 200 && status < 300) return 'default' as const;
  if (status >= 400) return 'destructive' as const;
  return 'secondary' as const;
}

function methodClass(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'POST':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'PATCH':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
    case 'PUT':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function DetailBlock({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {onCopy ? (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCopy}>
            <Copy className="size-3.5" />
            Copy
          </Button>
        ) : null}
      </div>
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function RequestRow({
  record,
  selected,
  onSelect,
}: {
  record: RequestInspectionRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const failed = Boolean(record.errorMessage) || (record.statusCode != null && record.statusCode >= 400);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50',
        selected && 'border-ring bg-muted/40',
        failed && 'border-destructive/40',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide',
            methodClass(record.method),
          )}
        >
          {record.method}
        </span>
        <Badge variant={statusTone(record.statusCode, record.errorMessage)}>
          {record.statusCode ?? 'ERR'}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatDuration(record.durationMs)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatRelativeTime(record.finishedAt ?? record.startedAt)}
        </span>
      </div>
      <p className="truncate font-mono text-xs text-foreground/90" title={record.url}>
        {shortenUrl(record.url)}
      </p>
      {record.errorMessage ? (
        <p className="line-clamp-1 text-xs text-destructive">{record.errorMessage}</p>
      ) : null}
    </button>
  );
}

export function InspectorView() {
  const { hydrated, isConfigured, recentRequests, clearRecentRequests } = useConnection();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => recentRequests.find((entry) => entry.id === selectedId) ?? null,
    [recentRequests, selectedId],
  );

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Request Inspector</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Live log of Azure DevOps calls made through this session. Authorization headers are
            redacted. Kept in memory only (last 25 requests).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="touch-target h-11"
          disabled={recentRequests.length === 0}
          onClick={() => {
            clearRecentRequests();
            setSelectedId(null);
            toast.message('Request log cleared');
          }}
        >
          <Eraser className="size-4" />
          Clear
        </Button>
      </div>

      {!isConfigured ? (
        <Alert>
          <Radar className="size-4" />
          <AlertTitle>Connect first</AlertTitle>
          <AlertDescription>
            Save your organization and access token, then use the app — requests will appear here
            as you navigate.
          </AlertDescription>
        </Alert>
      ) : null}

      {isConfigured && recentRequests.length === 0 ? (
        <Alert>
          <Radar className="size-4" />
          <AlertTitle>No requests yet</AlertTitle>
          <AlertDescription>
            Open Work Items, Queries, or Test Connection on Settings — each ADO call shows up in
            this list.
          </AlertDescription>
        </Alert>
      ) : null}

      {recentRequests.length > 0 ? (
        <div className="flex flex-col gap-2">
          {recentRequests.map((record) => (
            <RequestRow
              key={record.id}
              record={record}
              selected={record.id === selectedId}
              onSelect={() => setSelectedId(record.id)}
            />
          ))}
        </div>
      ) : null}

      <Sheet
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold',
                      methodClass(selected.method),
                    )}
                  >
                    {selected.method}
                  </span>
                  <Badge variant={statusTone(selected.statusCode, selected.errorMessage)}>
                    {selected.statusCode ?? 'ERR'}
                    {selected.statusText ? ` ${selected.statusText}` : ''}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="font-mono text-xs break-all">
                  {selected.url}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText('URL', selected.url)}
                  >
                    <Copy className="size-3.5" />
                    Copy URL
                  </Button>
                  {selected.requestId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText('Request ID', selected.requestId!)}
                    >
                      <Copy className="size-3.5" />
                      Copy request ID
                    </Button>
                  ) : null}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-medium">{formatDuration(selected.durationMs)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Finished</dt>
                    <dd className="font-medium">
                      {formatRelativeTime(selected.finishedAt ?? selected.startedAt)}
                    </dd>
                  </div>
                  {selected.requestId ? (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Request ID</dt>
                      <dd className="font-mono text-xs break-all">{selected.requestId}</dd>
                    </div>
                  ) : null}
                  {selected.errorMessage ? (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Error</dt>
                      <dd className="text-destructive">{selected.errorMessage}</dd>
                    </div>
                  ) : null}
                </dl>

                <DetailBlock
                  title="Request headers"
                  value={prettyBody(JSON.stringify(selected.headers))}
                />
                <DetailBlock
                  title="Request body"
                  value={prettyBody(selected.body)}
                  onCopy={
                    selected.body
                      ? () => void copyText('Request body', selected.body!)
                      : undefined
                  }
                />
                <DetailBlock
                  title="Response body"
                  value={prettyBody(selected.responseBody)}
                  onCopy={
                    selected.responseBody
                      ? () => void copyText('Response body', selected.responseBody!)
                      : undefined
                  }
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

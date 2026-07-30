'use client';

import { Copy, Inbox } from 'lucide-react';
import { toast } from 'sonner';

import type { RequestInspectionRecord } from '@core/types';
import { useConnection } from '@/components/providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

function statusVariant(
  statusCode: number | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (statusCode === null) return 'outline';
  if (statusCode >= 200 && statusCode < 300) return 'default';
  if (statusCode >= 400) return 'destructive';
  return 'secondary';
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function RequestRow({ record }: { record: RequestInspectionRecord }) {
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(record.url);
      toast.success('Request URL copied');
    } catch {
      toast.error('Could not copy the URL');
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {record.method}
          </Badge>
          <Badge variant={statusVariant(record.statusCode)} className="font-mono text-xs">
            {record.statusCode ?? '…'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDuration(record.durationMs)} · {formatTime(record.startedAt)}
          </span>
        </div>
        <p className="truncate font-mono text-xs sm:text-sm" title={record.url}>
          {record.url}
        </p>
        {record.errorMessage ? (
          <p className="text-xs text-destructive">{record.errorMessage}</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="touch-target size-11 shrink-0"
        onClick={() => void copyUrl()}
        aria-label="Copy request URL"
      >
        <Copy className="size-4" />
      </Button>
    </li>
  );
}

export function DashboardRecentRequests() {
  const { recentRequests } = useConnection();

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">Recent requests</CardTitle>
        <CardDescription>
          Latest Azure DevOps API calls from this session. Authorization details stay
          hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {recentRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Inbox className="size-8 opacity-60" aria-hidden />
            <p>
              No requests yet. Test your connection or open a feature to see traffic here.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[min(24rem,50vh)] pr-3">
            <ul className="flex flex-col gap-2">
              {recentRequests.map((record) => (
                <RequestRow key={record.id} record={record} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

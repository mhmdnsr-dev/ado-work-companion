'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import type { RequestInspectionRecord } from '@core/types';
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

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export function RequestInspectorCard({
  record,
  title = 'Request inspector',
}: {
  record: RequestInspectionRecord | null | undefined;
  title?: string;
}) {
  if (!record) {
    return (
      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>
            The last Azure DevOps call for this view will appear here. Authorization stays
            redacted.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 text-sm text-muted-foreground">
          No request yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {record.method}
            </Badge>
            <Badge
              variant={statusVariant(record.statusCode)}
              className="font-mono text-xs"
            >
              {record.statusCode ?? '…'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDuration(record.durationMs)}
            </span>
          </div>
        </div>
        <CardDescription>
          Auth headers are redacted. Use copy to inspect URL or response snippets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              URL
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => void copyText('URL', record.url)}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <p className="rounded-md bg-muted/50 p-3 font-mono text-xs break-all">
            {record.url}
          </p>
        </div>

        {record.errorMessage ? (
          <p className="text-sm text-destructive">{record.errorMessage}</p>
        ) : null}

        {record.responseBody ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Response body
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={() => void copyText('Response', record.responseBody ?? '')}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
            <ScrollArea className="h-40 rounded-md border border-border">
              <pre className="p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
                {record.responseBody.length > 8000
                  ? `${record.responseBody.slice(0, 8000)}\n…truncated`
                  : record.responseBody}
              </pre>
            </ScrollArea>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

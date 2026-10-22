'use client';

import Link from 'next/link';
import { Building2, CheckCircle2, FolderKanban, PlugZap, Settings2 } from 'lucide-react';

import { useConnection } from '@/components/providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function connectionBadge(status: string) {
  switch (status) {
    case 'connected':
      return <Badge className="bg-success text-success-foreground">Connected</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'unconfigured':
      return <Badge variant="secondary">Not configured</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

/**
 * Compact connection summary. Technical details (API version, token storage)
 * live in Settings instead of taking over the dashboard.
 */
export function DashboardStatusCards() {
  const { settings, health, testConnection } = useConnection();
  const projectLabel = settings.project?.trim() || 'Whole organization';

  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-medium">
              {settings.organization || 'No organization'}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-2">
            <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{projectLabel}</span>
          </span>
          {connectionBadge(health.status)}
          {health.message ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {health.message}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="touch-target h-9 gap-2"
            onClick={() => void testConnection()}
          >
            {health.status === 'connected' ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <PlugZap className="size-4" aria-hidden />
            )}
            Test connection
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="touch-target h-9 gap-2"
            asChild
          >
            <Link href="/settings">
              <Settings2 className="size-4" aria-hidden />
              Settings
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

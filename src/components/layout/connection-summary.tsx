'use client';

import { useConnection } from '@/components/providers';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ConnectionSummaryProps {
  className?: string;
  compact?: boolean;
}

export function ConnectionSummary({
  className,
  compact = false,
}: ConnectionSummaryProps) {
  const { settings, health, hasServerPat } = useConnection();
  const projectLabel = settings.project?.trim() || 'Organization only';

  if (compact) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
        <p className="truncate text-sm font-medium">{settings.organization || '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{projectLabel}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge variant="secondary" className="max-w-[12rem] truncate font-normal">
        {settings.organization || 'No organization'}
      </Badge>
      <Badge variant="outline" className="max-w-[12rem] truncate font-normal">
        {projectLabel}
      </Badge>
      <Badge variant="outline" className="font-mono text-xs font-normal">
        API {settings.apiVersion}
      </Badge>
      <Badge variant={hasServerPat ? 'default' : 'destructive'} className="font-normal">
        {hasServerPat ? 'Token saved' : 'No token'}
      </Badge>
      {health.status === 'connected' ? (
        <Badge className="bg-success font-normal text-success-foreground">
          Connected
        </Badge>
      ) : null}
      {health.status === 'failed' ? (
        <Badge variant="destructive" className="font-normal">
          Connection issue
        </Badge>
      ) : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  FolderKanban,
  KeyRound,
  PlugZap,
  Server,
} from 'lucide-react';
import type { ReactNode } from 'react';

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

function StatusCard({
  title,
  description,
  value,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  value: ReactNode;
  icon: typeof Building2;
  action?: ReactNode;
}) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="gap-2 px-5 [.border-b]:pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
          {action}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <div className="text-lg font-semibold tracking-tight break-all text-foreground">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

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

export function DashboardStatusCards() {
  const { settings, health, hasServerPat, testConnection } = useConnection();
  const projectLabel = settings.project?.trim() || 'Organization only';

  return (
    <section
      aria-label="Connection overview"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <StatusCard
        title="Organization"
        description="Active Azure DevOps organization"
        icon={Building2}
        value={settings.organization || '—'}
      />
      <StatusCard
        title="Project"
        description="Optional project scope"
        icon={FolderKanban}
        value={projectLabel}
        action={
          <Button variant="outline" size="sm" className="touch-target h-11" asChild>
            <Link href="/configure">Change</Link>
          </Button>
        }
      />
      <StatusCard
        title="API version"
        description="REST API version used for requests"
        icon={Server}
        value={<span className="font-mono">{settings.apiVersion}</span>}
      />
      <StatusCard
        title="Access token"
        description="Secure token saved for this browser"
        icon={KeyRound}
        value={
          hasServerPat ? (
            <Badge className="bg-success text-success-foreground">Saved securely</Badge>
          ) : (
            <Badge variant="destructive">Missing</Badge>
          )
        }
        action={
          <Button variant="outline" size="sm" className="touch-target h-11" asChild>
            <Link href="/configure">{hasServerPat ? 'Update' : 'Add token'}</Link>
          </Button>
        }
      />
      <StatusCard
        title="Connection"
        description={health.message ?? 'Test your Azure DevOps connection anytime'}
        icon={health.status === 'connected' ? CheckCircle2 : PlugZap}
        value={connectionBadge(health.status)}
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="touch-target h-11"
            onClick={() => void testConnection()}
          >
            Test now
          </Button>
        }
      />
    </section>
  );
}

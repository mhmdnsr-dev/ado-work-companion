'use client';

import Link from 'next/link';
import { createElement } from 'react';
import { ArrowRight } from 'lucide-react';

import { NAV_ITEMS } from '@core/constants';
import { useConnection } from '@/components/providers';
import { getNavIcon } from '@/components/layout/nav-icons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const QUICK_ACTIONS = NAV_ITEMS.filter((item) =>
  ['work-items', 'queries', 'estimate', 'comments'].includes(item.id),
);

const ACTION_HINTS: Record<string, string> = {
  'work-items': 'Find and update tasks, bugs, and user stories',
  queries: 'Run saved searches across your backlog',
  estimate: 'Open the same Estimate hub sessions as Azure DevOps',
  comments: 'Review discussion on work items',
};

export function DashboardQuickActions() {
  const { settings } = useConnection();
  const scope = settings.project?.trim() || settings.organization;

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">Continue organizing</CardTitle>
        <CardDescription>
          Jump into the work that matters in{' '}
          <span className="font-medium text-foreground">{scope}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <ul className="flex flex-col gap-2">
          {QUICK_ACTIONS.map((item) => (
            <li key={item.id}>
              <Button
                variant="secondary"
                className="touch-target h-auto min-h-11 w-full justify-between gap-3 py-3 text-left"
                asChild
              >
                <Link href={item.href}>
                  <span className="flex min-w-0 items-start gap-3">
                    {createElement(getNavIcon(item.icon), {
                      className: 'mt-0.5 size-4 shrink-0',
                      'aria-hidden': true,
                    })}
                    <span className="min-w-0">
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {ACTION_HINTS[item.id] ?? item.label}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 opacity-60" aria-hidden />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

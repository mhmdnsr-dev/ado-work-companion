'use client';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';

import { APP_INFO, NAV_ITEMS } from '@core/constants';
import { BrandMark } from '@/components/brand';
import { NavLink } from '@/components/layout/nav-link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        className,
      )}
      aria-label="Primary"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <BrandMark size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            {APP_INFO.shortName}
          </p>
          <p className="truncate text-xs text-muted-foreground">Work Companion</p>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <Link
          href="/configure"
          onClick={onNavigate}
          className="touch-target flex w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <KeyRound className="size-4 shrink-0" aria-hidden />
          Update connection
        </Link>
      </div>
    </aside>
  );
}

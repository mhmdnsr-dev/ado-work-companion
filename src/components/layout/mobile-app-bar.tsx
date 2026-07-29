'use client';

import { Menu } from 'lucide-react';

import { ConnectionSummary } from '@/components/layout/connection-summary';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';

interface MobileAppBarProps {
  onOpenMenu: () => void;
}

export function MobileAppBar({ onOpenMenu }: MobileAppBarProps) {
  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="touch-target size-11 shrink-0"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">ADO Explorer</p>
        <ConnectionSummary compact />
      </div>

      <ThemeToggle />
    </header>
  );
}

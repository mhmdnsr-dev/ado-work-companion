'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';

import { APP_INFO, NAV_ITEMS } from '@core/constants';
import { ConnectionSummary } from '@/components/layout/connection-summary';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function titleForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? APP_INFO.name;
}

export function AppTopbar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:flex md:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold tracking-tight">{title}</p>
      </div>

      <ConnectionSummary className="hidden lg:flex" />

      <Separator orientation="vertical" className="hidden h-8 lg:block" />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="touch-target size-11" asChild>
          <Link href="/settings" aria-label="Settings">
            <Settings className="size-4" aria-hidden />
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

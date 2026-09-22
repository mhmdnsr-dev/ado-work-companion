'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ellipsis, LayoutDashboard, ListTodo, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

const MOBILE_TABS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/work-items', label: 'Work Items', Icon: ListTodo },
  { href: '/queries', label: 'Queries', Icon: Search },
] as const;

export function MobileBottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const pathname = usePathname();
  const moreActive = pathname === '/settings' || pathname === '/help';

  return (
    <nav
      aria-label="Primary"
      className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden"
    >
      <div className="grid h-16 grid-cols-4">
        {MOBILE_TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors active:bg-muted',
                active && 'text-primary',
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Open more navigation"
          aria-current={moreActive ? 'page' : undefined}
          className={cn(
            'flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors active:bg-muted',
            moreActive && 'text-primary',
          )}
          onClick={onOpenMore}
        >
          <Ellipsis className="size-5" strokeWidth={moreActive ? 2.5 : 2} aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

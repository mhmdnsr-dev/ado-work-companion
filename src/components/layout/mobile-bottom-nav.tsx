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

  const tabClass =
    'group flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-medium text-muted-foreground';
  // Active tab: a pill behind the icon, readable at a glance on any ground.
  const iconClass = (active: boolean) =>
    cn(
      'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-(--duration-moderate) ease-(--ease-standard)',
      active ? 'bg-primary/15 text-primary' : 'group-active:bg-muted',
    );

  return (
    <nav
      aria-label="Primary"
      className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-md md:hidden"
    >
      <div className="grid h-16 grid-cols-4">
        {MOBILE_TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={tabClass}
            >
              <span className={iconClass(active)}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
              </span>
              <span
                className={cn(
                  'max-w-full truncate',
                  active && 'font-semibold text-foreground',
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Open more navigation"
          aria-current={moreActive ? 'page' : undefined}
          className={tabClass}
          onClick={onOpenMore}
        >
          <span className={iconClass(moreActive)}>
            <Ellipsis className="size-5" strokeWidth={moreActive ? 2.4 : 2} aria-hidden />
          </span>
          <span className={cn(moreActive && 'font-semibold text-foreground')}>More</span>
        </button>
      </div>
    </nav>
  );
}

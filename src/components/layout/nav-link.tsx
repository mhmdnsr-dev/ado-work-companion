'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createElement } from 'react';

import type { NavItem } from '@core/constants';
import { getNavIcon } from '@/components/layout/nav-icons';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  item: NavItem;
  onNavigate?: () => void;
  className?: string;
}

export function NavLink({ item, onNavigate, className }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'touch-target relative flex w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        // Active: an accent bar on the leading edge instead of a ring.
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-primary before:content-['']",
        className,
      )}
    >
      {createElement(getNavIcon(item.icon), {
        className: 'size-4 shrink-0',
        'aria-hidden': true,
      })}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

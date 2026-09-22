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
        'touch-target flex w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active &&
          'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring',
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

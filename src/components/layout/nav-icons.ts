import type { LucideIcon } from 'lucide-react';
import { BookOpen, LayoutDashboard, ListTodo, Search, Settings } from 'lucide-react';

import type { NavItem } from '@core/constants';

const NAV_ICON_MAP = {
  LayoutDashboard,
  ListTodo,
  Search,
  Settings,
  BookOpen,
} as const satisfies Record<NavItem['icon'], LucideIcon>;

export function getNavIcon(name: NavItem['icon']): LucideIcon {
  return NAV_ICON_MAP[name];
}

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Dices,
  Info,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Paperclip,
  Search,
  Settings,
} from 'lucide-react';

import type { NavItem } from '@core/constants';

const NAV_ICON_MAP = {
  LayoutDashboard,
  ListTodo,
  Search,
  MessageSquare,
  Paperclip,
  Dices,
  Settings,
  BookOpen,
  Info,
} as const satisfies Record<NavItem['icon'], LucideIcon>;

export function getNavIcon(name: NavItem['icon']): LucideIcon {
  return NAV_ICON_MAP[name];
}

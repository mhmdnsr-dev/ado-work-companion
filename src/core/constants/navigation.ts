/**
 * Canonical app navigation model.
 * Route paths are web-oriented; labels/icons are shared with a future mobile shell.
 */
export const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    id: 'work-items',
    label: 'Work Items',
    href: '/work-items',
    icon: 'ListTodo',
  },
  {
    id: 'queries',
    label: 'Queries',
    href: '/queries',
    icon: 'Search',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
  },
  {
    id: 'help',
    label: 'Help & About',
    href: '/help',
    icon: 'BookOpen',
  },
] as const;

export type NavItemId = (typeof NAV_ITEMS)[number]['id'];
export type NavItem = (typeof NAV_ITEMS)[number];

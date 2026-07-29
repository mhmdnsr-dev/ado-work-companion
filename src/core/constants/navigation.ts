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
    id: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: 'FolderKanban',
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
    id: 'comments',
    label: 'Comments',
    href: '/comments',
    icon: 'MessageSquare',
  },
  {
    id: 'metadata',
    label: 'Metadata',
    href: '/metadata',
    icon: 'Database',
  },
  {
    id: 'attachments',
    label: 'Attachments',
    href: '/attachments',
    icon: 'Paperclip',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
  },
  {
    id: 'about',
    label: 'About',
    href: '/about',
    icon: 'Info',
  },
] as const;

export type NavItemId = (typeof NAV_ITEMS)[number]['id'];
export type NavItem = (typeof NAV_ITEMS)[number];

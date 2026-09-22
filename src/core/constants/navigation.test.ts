import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from './navigation';

describe('NAV_ITEMS', () => {
  it('contains only the focused product destinations', () => {
    expect(NAV_ITEMS.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: 'dashboard', href: '/dashboard' },
      { id: 'work-items', href: '/work-items' },
      { id: 'queries', href: '/queries' },
      { id: 'settings', href: '/settings' },
      { id: 'help', href: '/help' },
    ]);
  });
});

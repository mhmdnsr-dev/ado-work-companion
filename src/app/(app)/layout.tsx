import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { RequireConfiguration } from '@/components/providers/require-configuration';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Authenticated app shell: sidebar / top bar / mobile drawer.
 * /configure stays outside this route group.
 * Default noindex — public About overrides robots on its page.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <RequireConfiguration>
      <AppShell>{children}</AppShell>
    </RequireConfiguration>
  );
}

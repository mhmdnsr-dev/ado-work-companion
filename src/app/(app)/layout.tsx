import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { RequireConfiguration } from '@/components/providers/require-configuration';

/**
 * Authenticated app shell: sidebar / top bar / mobile drawer.
 * /configure stays outside this route group.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <RequireConfiguration>
      <AppShell>{children}</AppShell>
    </RequireConfiguration>
  );
}

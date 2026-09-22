import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { RequireConfiguration } from '@/components/providers/require-configuration';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Authenticated app shell: desktop sidebar / top bar and mobile bottom navigation.
 * Settings and public Help live outside this configured app group.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <RequireConfiguration>
      <AppShell>{children}</AppShell>
    </RequireConfiguration>
  );
}

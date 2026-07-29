import type { ReactNode } from 'react';

import { RequireConfiguration } from '@/components/providers/require-configuration';
import { AppFooter } from '@/components/shared/app-footer';

/**
 * App shell layout (sidebar arrives in Step 5).
 * Requires a configured session; /configure remains outside this group.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <RequireConfiguration>
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </div>
    </RequireConfiguration>
  );
}

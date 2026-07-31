import type { Metadata } from 'next';
import Link from 'next/link';

import { APP_INFO } from '@core/constants';

export const metadata: Metadata = {
  title: 'Offline',
  description: `You are offline. Reconnect to continue using ${APP_INFO.name}.`,
  robots: { index: false, follow: false },
};

/**
 * Offline shell shown when a navigated document cannot be fetched.
 * Kept outside authenticated route groups so it never requires a PAT cookie.
 */
export default function OfflinePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Offline
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">You’re offline</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          {APP_INFO.shortName} needs a network connection to reach Azure DevOps. Some
          cached pages may still open; reconnect to load projects and work items.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </Link>
    </main>
  );
}

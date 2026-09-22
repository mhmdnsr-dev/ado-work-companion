'use client';

import { useState } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { useConnection } from '@/components/providers';
import { AppFooter } from '@/components/shared/app-footer';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfigurationForm } from '@/features/config';
import { SettingsView } from '@/features/settings/settings-view';

export function SettingsRoute() {
  const { hydrated, isConfigured } = useConnection();

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6" role="status">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
        <span className="sr-only">Loading settings…</span>
      </div>
    );
  }

  return <HydratedSettingsRoute initiallyConfigured={isConfigured} />;
}

function HydratedSettingsRoute({
  initiallyConfigured,
}: {
  initiallyConfigured: boolean;
}) {
  const { isConfigured } = useConnection();
  const [focusedSetup, setFocusedSetup] = useState(!initiallyConfigured);

  if (!isConfigured || focusedSetup) {
    return (
      <div className="flex min-h-dvh w-full flex-col bg-background">
        <main
          id="main-content"
          className="flex flex-1 flex-col items-center justify-center px-4 py-10"
        >
          <div className="w-full max-w-2xl">
            <ConfigurationForm mode="setup" />
          </div>
        </main>
        <AppFooter className="border-t border-border px-4 py-5 text-center text-sm text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell>
      <SettingsView onConnectionReset={() => setFocusedSetup(true)} />
    </AppShell>
  );
}

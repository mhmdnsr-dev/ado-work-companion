'use client';

import { ConfigurationForm } from '@/features/config';
import { AppFooter } from '@/components/shared/app-footer';

/**
 * Configuration is always reachable so users can update org / project / PAT.
 * Home (`/`) redirects configured sessions to the dashboard.
 */
export default function ConfigurePage() {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-gradient-to-b from-background via-background to-accent/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.563_0.156_254.3_/_0.08),_transparent_55%)]"
      />
      <main
        id="main-content"
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-2xl">
          <ConfigurationForm />
        </div>
      </main>
      <AppFooter className="relative z-10 border-t border-border/60 px-4 py-5 text-center text-sm text-muted-foreground" />
    </div>
  );
}

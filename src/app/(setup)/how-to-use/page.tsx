import type { Metadata } from 'next';

import { HowToUseView } from '@/features/how-to-use';
import { AppFooter } from '@/components/shared/app-footer';

export const metadata: Metadata = {
  title: 'How to use',
  description:
    'Connect with a PAT, explore features, and use Work Items in Azure DevOps API Explorer.',
};

/**
 * Public guide — reachable before and after connecting (outside RequireConfiguration).
 */
export default function HowToUsePage() {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-gradient-to-b from-background via-background to-accent/30">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.563_0.156_254.3_/_0.08),_transparent_55%)]"
      />
      <main id="main-content" className="relative z-10 flex-1 px-4 py-10">
        <HowToUseView />
      </main>
      <AppFooter className="relative z-10 border-t border-border/60 px-4 py-5 text-center text-sm text-muted-foreground" />
    </div>
  );
}

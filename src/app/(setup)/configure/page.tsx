import type { Metadata } from 'next';

import { ConfigurationForm } from '@/features/config';

export const metadata: Metadata = {
  title: 'Configure',
  description: 'Connect Azure DevOps with your organization and personal access token.',
};

export default function ConfigurePage() {
  return (
    <main
      id="main-content"
      className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-gradient-to-b from-background via-background to-accent/30 px-4 py-10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.563_0.156_254.3_/_0.08),_transparent_55%)]"
      />
      <div className="relative z-10 w-full max-w-2xl">
        <ConfigurationForm />
      </div>
    </main>
  );
}

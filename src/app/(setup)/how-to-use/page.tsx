import type { Metadata } from 'next';

import { APP_INFO } from '@core/constants';
import { HowToUseView } from '@/features/how-to-use';
import { AppFooter } from '@/components/shared/app-footer';
import { JsonLd } from '@/components/seo/json-ld';
import { buildHowToUseSchema } from '@/lib/seo/schema';

const description = `Connect and use ${APP_INFO.shortName} for Azure DevOps tasks—status, hours, comments, and attachments.`;

export const metadata: Metadata = {
  title: 'How to use',
  description,
  alternates: { canonical: '/how-to-use' },
  openGraph: {
    title: `How to use · ${APP_INFO.name}`,
    description,
    url: '/how-to-use',
  },
};

/**
 * Public guide — reachable before and after connecting (outside RequireConfiguration).
 */
export default function HowToUsePage() {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-gradient-to-b from-background via-background to-accent/30">
      <JsonLd data={buildHowToUseSchema()} />
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

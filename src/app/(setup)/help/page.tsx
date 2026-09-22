import type { Metadata } from 'next';

import { APP_INFO } from '@core/constants';
import { JsonLd } from '@/components/seo/json-ld';
import { AppFooter } from '@/components/shared/app-footer';
import { HelpView } from '@/features/help';
import { buildHelpPageSchema } from '@/lib/seo/schema';

const description = `Help for ${APP_INFO.name}: connect Azure DevOps, manage daily work, and contact the author.`;

export const metadata: Metadata = {
  title: 'Help & About',
  description,
  alternates: { canonical: '/help' },
  openGraph: {
    title: `Help & About · ${APP_INFO.name}`,
    description,
    url: '/help',
  },
};

export default function HelpPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      <JsonLd data={buildHelpPageSchema()} />
      <main id="main-content" className="flex-1 px-4 py-10 sm:px-6">
        <HelpView />
      </main>
      <AppFooter />
    </div>
  );
}

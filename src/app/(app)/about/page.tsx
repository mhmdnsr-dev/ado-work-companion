import type { Metadata } from 'next';

import { APP_INFO } from '@core/constants';
import { JsonLd } from '@/components/seo/json-ld';
import { AboutView } from '@/features/about';
import { buildAboutPageSchema } from '@/lib/seo/schema';

const description = `About ${APP_INFO.name} — who it’s for, daily task work, and how to get help.`;

export const metadata: Metadata = {
  title: 'About',
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: '/about' },
  openGraph: {
    title: `About · ${APP_INFO.name}`,
    description,
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={buildAboutPageSchema()} />
      <AboutView />
    </>
  );
}

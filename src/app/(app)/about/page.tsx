import type { Metadata } from 'next';

import { APP_INFO, AUTHOR } from '@core/constants';
import { JsonLd } from '@/components/seo/json-ld';
import { AboutView } from '@/features/about';
import { getSiteUrl } from '@/lib/site-url';

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
  const site = getSiteUrl().origin;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: APP_INFO.name,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: APP_INFO.description,
          url: `${site}/about`,
          author: {
            '@type': 'Person',
            name: AUTHOR.name,
            url: AUTHOR.url,
            email: AUTHOR.email,
          },
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        }}
      />
      <AboutView />
    </>
  );
}

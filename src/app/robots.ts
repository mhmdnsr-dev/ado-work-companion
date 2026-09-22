import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl().origin;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/help', '/llms.txt'],
        disallow: [
          '/api/',
          '/dashboard',
          '/work-items',
          '/queries',
          '/settings',
          '/offline',
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}

import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl().origin;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/configure', '/how-to-use', '/about'],
        disallow: [
          '/api/',
          '/dashboard',
          '/work-items',
          '/comments',
          '/attachments',
          '/queries',
          '/estimate',
          '/settings',
          '/offline',
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}

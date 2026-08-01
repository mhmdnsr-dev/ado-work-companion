import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

/**
 * Sitemap following https://www.sitemaps.org/protocol.html
 * (loc, lastmod, changefreq, priority) via Next MetadataRoute.
 * Image extensions (xmlns:image) included for brand assets on the home URL.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl().origin;
  const lastModified = new Date();

  return [
    {
      url: `${site}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
      images: [
        `${site}/icons/icon-512.png`,
        `${site}/brand/logo-lockup.png`,
      ],
    },
    {
      url: `${site}/how-to-use`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${site}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
      images: [`${site}/brand/logo-lockup.png`],
    },
    {
      url: `${site}/configure`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}

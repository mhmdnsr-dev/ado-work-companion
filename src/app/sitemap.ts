import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl().origin;
  const lastModified = new Date();

  return [
    {
      url: `${site}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
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
    },
    {
      url: `${site}/configure`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}

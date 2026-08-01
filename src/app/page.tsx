import type { Metadata } from 'next';

import { APP_INFO } from '@core/constants';
import { HomeGate } from '@/components/providers/home-gate';

export const metadata: Metadata = {
  title: { absolute: APP_INFO.name },
  description: APP_INFO.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: APP_INFO.name,
    description: APP_INFO.description,
    url: '/',
  },
};

/**
 * Entry: configured users → dashboard; otherwise → configure.
 * Org prefs live in localStorage; PAT lives in an HttpOnly cookie.
 */
export default function HomePage() {
  return <HomeGate />;
}

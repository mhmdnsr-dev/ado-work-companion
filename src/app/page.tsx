import { HomeGate } from '@/components/providers/home-gate';

/**
 * Entry: configured users → dashboard; otherwise → configure.
 * Org prefs live in localStorage; PAT lives in an HttpOnly cookie.
 */
export default function HomePage() {
  return <HomeGate />;
}

import { redirect } from 'next/navigation';

/**
 * Entry redirects into the configuration gate.
 * Step 2 will add persistence-aware routing (configured → /dashboard).
 */
export default function HomePage() {
  redirect('/configure');
}

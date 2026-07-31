import type { Metadata } from 'next';

import { APP_INFO } from '@core/constants';
import { AboutView } from '@/features/about';

export const metadata: Metadata = {
  title: 'About',
  description: `About ${APP_INFO.name} — who it’s for, daily task work, and how to get help.`,
};

export default function AboutPage() {
  return <AboutView />;
}

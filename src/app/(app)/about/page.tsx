import type { Metadata } from 'next';

import { AboutView } from '@/features/about';

export const metadata: Metadata = {
  title: 'About',
  description:
    'About Azure DevOps API Explorer — product overview, stack, and author details.',
};

export default function AboutPage() {
  return <AboutView />;
}

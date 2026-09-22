import type { Metadata } from 'next';

import { SettingsRoute } from '@/features/settings';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Connect Azure DevOps and manage preferences for this device.',
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsRoute />;
}

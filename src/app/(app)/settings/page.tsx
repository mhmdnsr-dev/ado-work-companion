import type { Metadata } from 'next';

import { SettingsView } from '@/features/settings';

export const metadata: Metadata = {
  title: 'Settings',
  description:
    'Appearance, install options, and your Azure DevOps connection for this device.',
};

export default function SettingsPage() {
  return <SettingsView />;
}

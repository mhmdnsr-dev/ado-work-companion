import type { Metadata } from 'next';

import { SettingsView } from '@/features/settings';

export const metadata: Metadata = {
  title: 'Settings',
  description:
    'Manage theme, Azure DevOps connection, and local preferences for this app.',
};

export default function SettingsPage() {
  return <SettingsView />;
}

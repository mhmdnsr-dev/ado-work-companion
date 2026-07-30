import type { Metadata } from 'next';

import { QueriesView } from '@/features/queries';

export const metadata: Metadata = {
  title: 'Queries',
  description: 'Browse and run saved Azure DevOps work item queries.',
};

export default function QueriesPage() {
  return <QueriesView />;
}

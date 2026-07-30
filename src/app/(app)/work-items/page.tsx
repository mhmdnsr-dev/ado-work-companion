import type { Metadata } from 'next';

import { WorkItemsView } from '@/features/work-items';

export const metadata: Metadata = {
  title: 'Work Items',
  description: 'Create, update, and organize tasks, bugs, and user stories.',
};

export default function WorkItemsPage() {
  return <WorkItemsView />;
}

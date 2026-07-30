import type { Metadata } from 'next';

import { MetadataView } from '@/features/metadata';

export const metadata: Metadata = {
  title: 'Metadata',
  description:
    'Browse Azure DevOps teams, work item types, fields, areas, iterations, and link types.',
};

export default function MetadataPage() {
  return <MetadataView />;
}

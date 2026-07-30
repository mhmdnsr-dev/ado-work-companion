import type { Metadata } from 'next';

import { ProjectsView } from '@/features/projects';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Browse Azure DevOps projects, inspect details, and set the active scope.',
};

export default function ProjectsPage() {
  return <ProjectsView />;
}

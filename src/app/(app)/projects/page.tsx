import type { Metadata } from 'next';

import { ProjectsView } from '@/features/projects';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Choose the Azure DevOps project you want to organize work in.',
};

export default function ProjectsPage() {
  return <ProjectsView />;
}

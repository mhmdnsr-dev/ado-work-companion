import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Configure',
  description: 'Connect Azure DevOps so you can update tasks, hours, comments, and attachments.',
};

export default function SetupLayout({ children }: { children: ReactNode }) {
  return children;
}

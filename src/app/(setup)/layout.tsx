import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Configure',
  description: 'Connect Azure DevOps with your organization and personal access token.',
};

export default function SetupLayout({ children }: { children: ReactNode }) {
  return children;
}

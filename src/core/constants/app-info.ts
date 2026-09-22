/**
 * Product metadata shown on About, PWA, and related surfaces.
 */
export const APP_INFO = {
  name: 'ADO Work Companion',
  shortName: 'ADO Work',
  version: '0.1.0',
  adoApiVersion: '7.2-preview',
  description:
    'A daily companion for anyone with Azure DevOps tasks—update status and remaining hours, add or read comments, and upload or view attachments without living in classic boards. Useful for developers, QA, product owners, and anyone else on the team.',
  /** Inclusive audience line for Help & About (not an exclusive list). */
  audience: 'Anyone with tasks in Azure DevOps',
  stack: [
    'Next.js App Router',
    'React 19',
    'TypeScript',
    'Tailwind CSS',
    'TanStack Query',
    'Azure DevOps REST API',
  ],
} as const;

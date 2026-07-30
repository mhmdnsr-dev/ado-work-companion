import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AttachmentsView } from '@/features/attachments';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Attachments',
  description: 'Upload, list, and download files attached to Azure DevOps work items.',
};

export default function AttachmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <AttachmentsView />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CommentsView } from '@/features/comments';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Comments',
  description: 'List, add, and refresh comments on Azure DevOps work items.',
};

export default function CommentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <CommentsView />
    </Suspense>
  );
}

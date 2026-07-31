import type { Metadata } from 'next';
import { Suspense } from 'react';

import { InspectorView } from '@/features/inspector';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Request Inspector',
  description: 'Inspect recent Azure DevOps API requests from this session.',
};

export default function InspectorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <InspectorView />
    </Suspense>
  );
}

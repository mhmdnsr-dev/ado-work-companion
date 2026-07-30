'use client';

import { useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

export function SprintNativeBurndownImage({
  chartPath,
  className,
}: {
  chartPath: string;
  className?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  if (status === 'error') {
    return null;
  }

  return (
    <div className={className}>
      {status === 'loading' ? (
        <Skeleton className="h-56 w-full rounded-lg" aria-hidden />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chartPath}
        alt="Sprint burndown chart from Azure DevOps"
        className={status === 'loaded' ? 'h-auto w-full rounded-lg' : 'sr-only'}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}

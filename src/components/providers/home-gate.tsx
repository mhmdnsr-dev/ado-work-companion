'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useConnection } from '@/components/providers';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/` gate after hydration:
 * - configured (org + PAT in session) → `/dashboard`
 * - otherwise → `/configure`
 */
export function HomeGate() {
  const router = useRouter();
  const { hydrated, isConfigured } = useConnection();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(isConfigured ? '/dashboard' : '/configure');
  }, [hydrated, isConfigured, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6" role="status">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <span className="sr-only">Checking saved configuration…</span>
    </div>
  );
}

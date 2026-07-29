'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useConnection } from '@/components/providers';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Protects app routes: unconfigured sessions go to /configure.
 * Configured users pass through; they can still open /configure to edit.
 */
export function RequireConfiguration({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { hydrated, isConfigured } = useConnection();

  useEffect(() => {
    if (!hydrated) return;
    if (!isConfigured) {
      router.replace('/configure');
    }
  }, [hydrated, isConfigured, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6" role="status">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </div>
        <span className="sr-only">Checking configuration…</span>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6" role="status">
        <p className="text-sm text-muted-foreground">Redirecting to configuration…</p>
      </div>
    );
  }

  return children;
}

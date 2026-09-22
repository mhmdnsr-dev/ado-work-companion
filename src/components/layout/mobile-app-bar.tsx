'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { APP_INFO, NAV_ITEMS } from '@core/constants';
import { ConnectionSummary } from '@/components/layout/connection-summary';
import { Button } from '@/components/ui/button';

export function MobileAppBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasDetail = searchParams.has('item') || searchParams.has('query');
  const title = hasDetail
    ? searchParams.has('item')
      ? `Work item #${searchParams.get('item')}`
      : 'Query'
    : (NAV_ITEMS.find((item) => item.href === pathname)?.label ?? APP_INFO.shortName);

  return (
    <header className="safe-top sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border bg-background px-2 md:hidden">
      {hasDetail ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target size-11"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="size-5" />
        </Button>
      ) : null}
      <div className="min-w-0 flex-1 px-2">
        <p className="truncate text-base font-semibold">{title}</p>
        {!hasDetail ? <ConnectionSummary compact /> : null}
      </div>
    </header>
  );
}

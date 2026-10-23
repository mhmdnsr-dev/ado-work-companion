'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { APP_INFO, NAV_ITEMS } from '@core/constants';
import { useConnection } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Project context in one tap-able pill; the dot shows connection health. */
function ProjectPill() {
  const { settings, health } = useConnection();
  const project = settings.project?.trim() || 'No project';
  const organization = settings.organization || 'No organization';

  return (
    <Link
      href="/settings"
      aria-label={`Project ${project} in ${organization}. Open settings`}
      className="touch-target flex max-w-[45%] min-w-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:bg-muted"
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          health.status === 'connected'
            ? 'bg-success'
            : health.status === 'failed'
              ? 'bg-destructive'
              : 'bg-state-proposed',
        )}
      />
      <span className="truncate">{project}</span>
    </Link>
  );
}

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
    <header className="safe-top sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center gap-1 px-2">
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
        {/* Pages hide their own header below md, so this is the phone page heading. */}
        <h1 className="min-w-0 flex-1 truncate px-2 text-lg font-semibold tracking-tight">
          {title}
        </h1>
        {!hasDetail ? <ProjectPill /> : null}
      </div>
    </header>
  );
}

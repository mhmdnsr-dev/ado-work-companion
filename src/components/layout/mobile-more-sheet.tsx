'use client';

import Link from 'next/link';
import { BookOpen, Download, KeyRound, Settings, Smartphone } from 'lucide-react';

import { APP_INFO } from '@core/constants';
import { usePwaInstall } from '@/components/pwa/pwa-install-provider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export function MobileMoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { capability, isStandalone, requestInstall, openInstallInstructions } =
    usePwaInstall();
  const canShowInstall = !isStandalone && capability !== 'unsupported';

  function close() {
    onOpenChange(false);
  }

  function handleInstall() {
    if (capability === 'native-prompt') void requestInstall();
    else openInstallInstructions();
    close();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mobile-safe-bottom max-h-[85dvh] gap-0 rounded-t-xl p-0 md:hidden"
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Connection, preferences, and help</SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 overflow-y-auto p-3">
          <Button
            variant="ghost"
            className="h-14 justify-start gap-3 px-3 text-base"
            asChild
          >
            <Link href="/settings" onClick={close}>
              <Settings className="size-5" aria-hidden />
              Settings
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="h-14 justify-start gap-3 px-3 text-base"
            asChild
          >
            <Link href="/configure" onClick={close}>
              <KeyRound className="size-5" aria-hidden />
              Update connection
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="h-14 justify-start gap-3 px-3 text-base"
            asChild
          >
            <Link href="/help" onClick={close}>
              <BookOpen className="size-5" aria-hidden />
              Help & About
            </Link>
          </Button>
          {canShowInstall ? (
            <Button
              variant="ghost"
              className="h-14 justify-start gap-3 px-3 text-base"
              onClick={handleInstall}
            >
              {capability === 'native-prompt' ? (
                <Download className="size-5" aria-hidden />
              ) : (
                <Smartphone className="size-5" aria-hidden />
              )}
              Install {APP_INFO.shortName}
            </Button>
          ) : null}
          <div className="mt-2 flex items-center justify-between border-t border-border px-3 pt-4">
            <span className="text-sm font-medium">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

'use client';

import { useState, type ReactNode } from 'react';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';
import { MobileAppBar } from '@/components/layout/mobile-app-bar';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { AppFooter } from '@/components/shared/app-footer';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full overflow-x-hidden bg-background">
      <AppSidebar className="fixed inset-y-0 left-0 z-40 hidden md:flex" />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col md:pl-64">
        <MobileAppBar onOpenMenu={() => setMobileNavOpen(true)} />
        <AppTopbar />

        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6 md:py-6">
            {children}
          </div>
          <AppFooter />
        </main>
      </div>

      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </div>
  );
}

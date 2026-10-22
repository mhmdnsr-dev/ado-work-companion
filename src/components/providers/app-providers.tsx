'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';

import { PwaInstallProvider } from '@/components/pwa/pwa-install-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

import { ConnectionProvider } from './connection-provider';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <ConnectionProvider>
            <PwaInstallProvider>
              {children}
              <Toaster
                richColors
                closeButton
                position="top-center"
                offset={{ top: '4rem', bottom: '2rem', left: '1rem', right: '1rem' }}
                mobileOffset={{
                  top: 'calc(4rem + env(safe-area-inset-top))',
                  bottom: 'calc(5rem + env(safe-area-inset-bottom))',
                  left: '0.75rem',
                  right: '0.75rem',
                }}
              />
            </PwaInstallProvider>
          </ConnectionProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

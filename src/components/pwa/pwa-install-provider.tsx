'use client';

import { Download, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { APP_INFO } from '@core/constants';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'ado.pwaInstallDismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallContextValue {
  canInstall: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

function subscribeStandalone(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const media = window.matchMedia('(display-mode: standalone)');
  const onChange = () => onStoreChange();
  media.addEventListener('change', onChange);
  window.addEventListener('appinstalled', onChange);
  return () => {
    media.removeEventListener('change', onChange);
    window.removeEventListener('appinstalled', onChange);
  };
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function usePwaInstall(): PwaInstallContextValue {
  const value = useContext(PwaInstallContext);
  if (!value) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }
  return value;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const standalone = useSyncExternalStore(
    subscribeStandalone,
    isStandaloneDisplay,
    () => false,
  );
  const storedDismissed = useSyncExternalStore(
    () => () => undefined,
    readDismissed,
    () => true,
  );
  const dismissed = storedDismissed || dismissedThisSession;

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const dismissBanner = useCallback(() => {
    setDismissedThisSession(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      canInstall: Boolean(deferred) && !standalone,
      isStandalone: standalone,
      promptInstall,
    }),
    [deferred, standalone, promptInstall],
  );

  const showBanner = value.canInstall && !dismissed;

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      {showBanner ? (
        <div
          role="region"
          aria-label="Install app"
          className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/90 md:inset-x-auto md:right-4 md:bottom-4 md:w-full md:max-w-sm md:rounded-xl md:border"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">Install {APP_INFO.shortName}</p>
              <p className="text-xs text-muted-foreground">
                Add a home-screen shortcut for faster access to your tasks. Offline covers
                the app shell only—Azure DevOps still needs a network.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Dismiss install prompt"
              onClick={dismissBanner}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="touch-target h-11 flex-1 gap-2"
              onClick={() => {
                void promptInstall().then((outcome) => {
                  if (outcome !== 'accepted') dismissBanner();
                });
              }}
            >
              <Download className="size-4" aria-hidden />
              Install
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-target h-11"
              onClick={dismissBanner}
            >
              Not now
            </Button>
          </div>
        </div>
      ) : null}
    </PwaInstallContext.Provider>
  );
}

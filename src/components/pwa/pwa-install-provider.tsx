'use client';

import { Check, Copy, Download, Share, Smartphone, X } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { detectInstallCapability, type InstallCapability } from './install-capability';

export type { InstallCapability } from './install-capability';

const DISMISS_KEY = 'ado.pwaInstallDismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallContextValue {
  capability: InstallCapability;
  isStandalone: boolean;
  requestInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  openInstallInstructions: () => void;
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
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

  const capability = detectInstallCapability({
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    platform: typeof navigator === 'undefined' ? '' : navigator.platform,
    maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
    standalone,
    nativePromptAvailable: Boolean(deferred),
  });

  const requestInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const openInstallInstructions = useCallback(() => {
    setCopyState('idle');
    setInstructionsOpen(true);
  }, []);

  const copyCurrentUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, []);

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
      capability,
      isStandalone: standalone,
      requestInstall,
      openInstallInstructions,
    }),
    [capability, standalone, requestInstall, openInstallInstructions],
  );

  const showBanner =
    !dismissed &&
    (capability === 'native-prompt' ||
      capability === 'ios-safari-manual' ||
      capability === 'ios-other-browser');

  const isOtherIosBrowser = capability === 'ios-other-browser';

  const handleBannerInstall = () => {
    if (capability === 'native-prompt') {
      void requestInstall().then((outcome) => {
        if (outcome !== 'accepted') dismissBanner();
      });
      return;
    }
    openInstallInstructions();
  };

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
              onClick={handleBannerInstall}
            >
              {capability === 'native-prompt' ? (
                <Download className="size-4" aria-hidden />
              ) : (
                <Smartphone className="size-4" aria-hidden />
              )}
              {capability === 'native-prompt' ? 'Install' : 'How to install'}
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
      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install {APP_INFO.shortName} on your iPhone</DialogTitle>
            <DialogDescription>
              {isOtherIosBrowser
                ? 'Apple requires home-screen web apps to be added from Safari.'
                : 'Use Safari’s Share menu to add this app to your Home Screen.'}
            </DialogDescription>
          </DialogHeader>

          {isOtherIosBrowser ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">First, open this page in Safari</p>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Copy this page’s link.</li>
                <li>Open Safari and paste the link into the address bar.</li>
                <li>Follow the Safari steps below.</li>
              </ol>
              <Button
                type="button"
                variant="outline"
                className="touch-target h-11 w-full gap-2"
                onClick={() => void copyCurrentUrl()}
              >
                {copyState === 'copied' ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copyState === 'copied' ? 'Link copied' : 'Copy link'}
              </Button>
              {copyState === 'failed' ? (
                <p role="alert" className="text-sm text-destructive">
                  The link could not be copied. Use this browser’s Share menu to copy it,
                  then open it in Safari.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3 border-t pt-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Share className="size-4" aria-hidden />
              In Safari
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Tap the Share button in Safari’s toolbar.</li>
              <li>Scroll down and tap Add to Home Screen.</li>
              <li>Turn on Open as Web App, then tap Add.</li>
            </ol>
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </PwaInstallContext.Provider>
  );
}

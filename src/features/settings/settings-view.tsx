'use client';

import { useTheme } from 'next-themes';
import { useMemo, useSyncExternalStore, useState, type ReactNode } from 'react';
import { Download, Monitor, Moon, RotateCcw, Smartphone, Sun } from 'lucide-react';
import { toast } from 'sonner';

import { STORAGE_KEYS, APP_INFO } from '@core/constants';
import { clearCollapsedTreeIds, clearWorkItemFilters } from '@core/domain';
import type { ThemePreference } from '@core/types';
import { useConnection } from '@/components/providers';
import { usePwaInstall } from '@/components/pwa/pwa-install-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfigurationForm } from '@/features/config';
import { createLocalStorageAdapter } from '@/lib/adapters';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  Icon: typeof Sun;
}[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Always use the light appearance.',
    Icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Always use the dark appearance.',
    Icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Match your device preference.',
    Icon: Monitor,
  },
];

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function SettingsView({ onConnectionReset }: { onConnectionReset?: () => void }) {
  const { hydrated, settings, setThemePreference } = useConnection();
  const { theme, setTheme } = useTheme();
  const { capability, isStandalone, requestInstall, openInstallInstructions } =
    usePwaInstall();
  const mounted = useIsClient();
  const [clearing, setClearing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const storage = useMemo(() => createLocalStorageAdapter(), []);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const currentTheme =
    (mounted ? (theme as ThemePreference | undefined) : undefined) ??
    settings.theme ??
    'system';

  async function onThemeChange(next: ThemePreference) {
    setTheme(next);
    await setThemePreference(next);
    toast.success(
      next === 'system' ? 'Theme follows your system setting' : `Theme set to ${next}`,
    );
  }

  async function onClearLocalPreferences() {
    setClearing(true);
    try {
      await clearWorkItemFilters(storage);
      await clearCollapsedTreeIds(storage);
      await storage.removeItem(STORAGE_KEYS.FAVORITES);
      await storage.removeItem(STORAGE_KEYS.DASHBOARD_TEAM);
      await storage.removeItem(STORAGE_KEYS.DASHBOARD_MEMBER);
      toast.success('Local preferences cleared');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not clear local preferences',
      );
    } finally {
      setClearing(false);
    }
  }

  async function onInstallApp() {
    setInstalling(true);
    try {
      const outcome = await requestInstall();
      if (outcome === 'accepted') {
        toast.success('App installed');
      } else if (outcome === 'unavailable') {
        toast.message('Install is not available in this browser right now');
      }
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 md:gap-8">
      <header className="hidden space-y-1 md:block">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Manage your Azure DevOps connection and this device’s preferences
          {settings.organization ? (
            <>
              {' ('}
              <span className="font-medium text-foreground">{settings.organization}</span>
              {').'}
            </>
          ) : (
            '.'
          )}
        </p>
      </header>

      <ConfigurationForm mode="settings" onResetComplete={onConnectionReset} />

      <SettingsSection
        title="Appearance"
        description="Saved on this device."
        labelledBy="settings-appearance"
      >
        {/* One row on phones: a segmented control instead of three tall cards. */}
        <div
          role="radiogroup"
          aria-labelledby="settings-appearance"
          className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1"
        >
          {THEME_OPTIONS.map(({ value, label, description, Icon }) => {
            const selected = currentTheme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                title={description}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selected && 'bg-background text-foreground shadow-xs',
                )}
                onClick={() => void onThemeChange(value)}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Home screen"
        description={`Add ${APP_INFO.shortName} to your home screen for a full-screen app. Azure DevOps still needs a network connection.`}
        labelledBy="settings-install"
      >
        {isStandalone ? (
          <p className="text-sm text-muted-foreground">
            You’re already using the installed app.
          </p>
        ) : capability === 'native-prompt' ? (
          <Button
            type="button"
            className="touch-target h-11 w-full gap-2 sm:w-auto"
            disabled={installing}
            onClick={() => void onInstallApp()}
          >
            <Download className="size-4" aria-hidden />
            {installing ? 'Opening install…' : `Install ${APP_INFO.shortName}`}
          </Button>
        ) : capability === 'ios-safari-manual' || capability === 'ios-other-browser' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              {capability === 'ios-safari-manual'
                ? 'Install from Safari’s Share menu to use this site like an app.'
                : 'Apple requires installation from Safari. We’ll help you move this page there.'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="touch-target h-11 gap-2"
              onClick={openInstallInstructions}
            >
              <Smartphone className="size-4" aria-hidden />
              Show installation steps
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This browser doesn’t offer installation. {APP_INFO.shortName} works normally
            here.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Local data"
        description="Clears saved work item filters, collapsed tree groups, dashboard picks, and favorites on this device. Your connection and theme stay."
        labelledBy="settings-local-data"
      >
        <Button
          id="clear-local-prefs"
          type="button"
          variant="outline"
          className="touch-target h-11 w-full gap-2 sm:w-auto"
          disabled={clearing}
          onClick={() => void onClearLocalPreferences()}
        >
          <RotateCcw className="size-4" />
          {clearing ? 'Clearing…' : 'Clear local preferences'}
        </Button>
      </SettingsSection>
    </div>
  );
}

/** A settings group: a quiet heading above one card, like platform settings lists. */
function SettingsSection({
  title,
  description,
  labelledBy,
  children,
}: {
  title: string;
  description?: string;
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className="space-y-2">
      <div className="space-y-0.5 px-1">
        <h2
          id={labelledBy}
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">{children}</div>
    </section>
  );
}

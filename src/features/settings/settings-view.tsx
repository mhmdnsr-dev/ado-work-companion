'use client';

import { useTheme } from 'next-themes';
import { useMemo, useSyncExternalStore, useState } from 'react';
import { Download, Monitor, Moon, RotateCcw, Smartphone, Sun } from 'lucide-react';
import { toast } from 'sonner';

import { STORAGE_KEYS, APP_INFO } from '@core/constants';
import { clearWorkItemFilters } from '@core/domain';
import type { ThemePreference } from '@core/types';
import { useConnection } from '@/components/providers';
import { usePwaInstall } from '@/components/pwa/pwa-install-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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

export function SettingsView() {
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-1">
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

      <ConfigurationForm mode="settings" />

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Appearance</CardTitle>
          <CardDescription>
            Choose how the app looks. This preference is saved on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="sr-only">Theme</legend>
            <div
              className="grid gap-3 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Theme"
            >
              {THEME_OPTIONS.map(({ value, label, description, Icon }) => {
                const selected = currentTheme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      selected && 'border-primary/50 bg-primary/5',
                    )}
                    onClick={() => void onThemeChange(value)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Install app</CardTitle>
          <CardDescription>
            Add {APP_INFO.shortName} to your home screen for a full-screen app feel. You
            still need a network connection to talk to Azure DevOps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isStandalone ? (
            <p className="text-sm text-muted-foreground">
              You’re already running the installed app.
            </p>
          ) : capability === 'native-prompt' ? (
            <Button
              type="button"
              className="touch-target h-11 gap-2"
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
              This browser does not expose an app installation option. You can continue
              using {APP_INFO.shortName} normally in the browser.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Local data</CardTitle>
          <CardDescription>
            Clear saved work item filters, dashboard team/member picks, and favorite nav
            shortcuts on this device. Connection and theme stay as they are.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor="clear-local-prefs" className="text-sm text-muted-foreground">
            Does not remove your organization or access token.
          </Label>
          <Button
            id="clear-local-prefs"
            type="button"
            variant="outline"
            className="touch-target h-11 gap-2"
            disabled={clearing}
            onClick={() => void onClearLocalPreferences()}
          >
            <RotateCcw className="size-4" />
            {clearing ? 'Clearing…' : 'Clear local preferences'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

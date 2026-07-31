'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AzureDevOpsApi } from '@core/api';
import {
  ADO_API,
  DEFAULT_PAT_COOKIE_LIFETIME,
  STORAGE_KEYS,
  type PatCookieLifetime,
} from '@core/constants';
import {
  clearConnectionLocalState,
  emptyClientSettings,
  loadConnectionHealth,
  loadPersistedSettings,
  saveConnectionHealth,
  savePersistedSettings,
} from '@core/domain';
import type { AdoPersistedSettings } from '@core/schemas';
import type {
  ConnectionHealth,
  RequestInspectionRecord,
  TeamProjectReference,
  ThemePreference,
} from '@core/types';
import { createFetchHttpClient, createLocalStorageAdapter } from '@/lib/adapters';
import { clearPatCookie, fetchPatStatus, savePatCookie } from '@/lib/config-api';

/** Live form values — org prefs → localStorage; PAT → HttpOnly cookie via /api/config. */
export interface LiveConnectionCredentials {
  organization: string;
  project?: string;
  apiVersion: string;
  /** Empty keeps the existing HttpOnly PAT cookie when one already exists. */
  pat: string;
  /** How long the encrypted PAT cookie should live on this device. */
  patCookieLifetime?: PatCookieLifetime;
}

interface ConnectionContextValue {
  hydrated: boolean;
  settings: AdoPersistedSettings;
  /** Always empty after hydrate — PAT is never kept in React state long-term. */
  pat: string;
  hasServerPat: boolean;
  health: ConnectionHealth;
  recentRequests: RequestInspectionRecord[];
  projects: TeamProjectReference[];
  projectsError: string | null;
  projectsLoading: boolean;
  api: AzureDevOpsApi | null;
  isConfigured: boolean;
  saveConfiguration: (input: LiveConnectionCredentials) => Promise<AzureDevOpsApi | null>;
  resetConfiguration: () => Promise<void>;
  clearRecentRequests: () => void;
  testConnection: (
    credentials?: LiveConnectionCredentials,
  ) => Promise<{ projectCount: number }>;
  loadProjects: (
    credentials?: LiveConnectionCredentials,
  ) => Promise<TeamProjectReference[]>;
  /** Updates the active project scope in localStorage and rebuilds the API client. */
  setActiveProject: (projectName: string | undefined) => Promise<void>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
}

const INSPECTION_BODY_MAX_CHARS = 32_768;

function truncateInspectionBody(value: string | null): string | null {
  if (value == null) return null;
  if (value.length <= INSPECTION_BODY_MAX_CHARS) return value;
  return `${value.slice(0, INSPECTION_BODY_MAX_CHARS)}\n… [truncated]`;
}

function sanitizeInspectionRecord(
  record: RequestInspectionRecord,
): RequestInspectionRecord {
  return {
    ...record,
    body: truncateInspectionBody(record.body),
    responseBody: truncateInspectionBody(record.responseBody),
  };
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

function createApi(params: {
  organization: string;
  project?: string;
  apiVersion: string;
  onRequestComplete: (record: RequestInspectionRecord) => void;
}): AzureDevOpsApi {
  return new AzureDevOpsApi({
    http: createFetchHttpClient(),
    organization: params.organization,
    project: params.project,
    apiVersion: params.apiVersion,
    proxyBaseUrl: '/api/ado',
    analyticsProxyBaseUrl: '/api/analytics',
    onRequestComplete: params.onRequestComplete,
  });
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const storage = useMemo(() => createLocalStorageAdapter(), []);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AdoPersistedSettings>(emptyClientSettings());
  const [hasServerPat, setHasServerPat] = useState(false);
  const [health, setHealth] = useState<ConnectionHealth>({ status: 'unconfigured' });
  const [recentRequests, setRecentRequests] = useState<RequestInspectionRecord[]>([]);
  const [projects, setProjects] = useState<TeamProjectReference[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [api, setApi] = useState<AzureDevOpsApi | null>(null);

  const pushInspection = useCallback((record: RequestInspectionRecord) => {
    const next = sanitizeInspectionRecord(record);
    setRecentRequests((prev) => [next, ...prev].slice(0, 25));
  }, []);

  const clearRecentRequests = useCallback(() => {
    setRecentRequests([]);
  }, []);

  const rebuildApi = useCallback(
    (next: { organization: string; project?: string; apiVersion: string }) => {
      if (!next.organization.trim()) {
        setApi(null);
        return null;
      }
      const instance = createApi({
        organization: next.organization.trim(),
        project: next.project?.trim() || undefined,
        apiVersion: next.apiVersion.trim() || ADO_API.DEFAULT_VERSION,
        onRequestComplete: pushInspection,
      });
      setApi(instance);
      return instance;
    },
    [pushInspection],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const persisted = await loadPersistedSettings(storage);
      const localHealth = await loadConnectionHealth(storage);

      // Purge any legacy plaintext PAT from older builds.
      await storage.removeItem(STORAGE_KEYS.PAT);
      await storage.removeItem(STORAGE_KEYS.REMEMBER_PAT);

      let patStatus = { hasPat: false };
      try {
        patStatus = await fetchPatStatus();
      } catch {
        patStatus = { hasPat: false };
      }

      if (cancelled) return;

      setSettings(persisted);
      setHasServerPat(patStatus.hasPat);

      const configured = Boolean(persisted.organization && patStatus.hasPat);
      setHealth(
        configured
          ? localHealth.status === 'unconfigured'
            ? { status: 'unknown' }
            : localHealth
          : { status: 'unconfigured' },
      );

      if (configured) {
        rebuildApi({
          organization: persisted.organization,
          project: persisted.project,
          apiVersion: persisted.apiVersion || ADO_API.DEFAULT_VERSION,
        });
      } else {
        setApi(null);
      }

      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [rebuildApi, storage]);

  const saveConfiguration = useCallback(
    async (input: LiveConnectionCredentials) => {
      const patCookieLifetime =
        input.patCookieLifetime ?? settings.patCookieLifetime ?? DEFAULT_PAT_COOKIE_LIFETIME;

      const nextSettings: AdoPersistedSettings = {
        organization: input.organization.trim(),
        project: input.project?.trim() || undefined,
        apiVersion: input.apiVersion.trim() || ADO_API.DEFAULT_VERSION,
        theme: settings.theme,
        patCookieLifetime,
      };

      await savePersistedSettings(storage, nextSettings);
      setSettings(nextSettings);

      const patStatus = await savePatCookie(input.pat.trim(), patCookieLifetime);
      setHasServerPat(patStatus.hasPat);

      if (!patStatus.hasPat || !nextSettings.organization) {
        setApi(null);
        setHealth({ status: 'unconfigured' });
        return null;
      }

      if (health.status === 'unconfigured') {
        setHealth({ status: 'unknown' });
      }

      return rebuildApi({
        organization: nextSettings.organization,
        project: nextSettings.project,
        apiVersion: nextSettings.apiVersion,
      });
    },
    [health.status, rebuildApi, settings.patCookieLifetime, settings.theme, storage],
  );

  const resetConfiguration = useCallback(async () => {
    await clearPatCookie();
    await clearConnectionLocalState(storage, { keepTheme: true });
    setSettings(emptyClientSettings(settings.theme));
    setHasServerPat(false);
    setHealth({ status: 'unconfigured' });
    setProjects([]);
    setProjectsError(null);
    setRecentRequests([]);
    setApi(null);
  }, [settings.theme, storage]);

  const resolveApi = useCallback(
    async (credentials?: LiveConnectionCredentials): Promise<AzureDevOpsApi> => {
      if (credentials) {
        const instance = await saveConfiguration(credentials);
        if (!instance) {
          throw new Error('Please save your organization and access token first.');
        }
        return instance;
      }
      if (!api) {
        throw new Error('Please save your connection settings first.');
      }
      return api;
    },
    [api, saveConfiguration],
  );

  const testConnection = useCallback(
    async (credentials?: LiveConnectionCredentials) => {
      const client = await resolveApi(credentials);

      try {
        const result = await client.testConnection();
        const nextHealth: ConnectionHealth = {
          status: 'connected',
          checkedAt: new Date().toISOString(),
          message: `Connected — ${result.data.projectCount} project${result.data.projectCount === 1 ? '' : 's'} available`,
          organizationName: result.data.organization,
        };
        setHealth(nextHealth);
        await saveConnectionHealth(storage, nextHealth);
        setProjects(result.data.projects);
        setProjectsError(null);
        return { projectCount: result.data.projectCount };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed';
        const nextHealth: ConnectionHealth = {
          status: 'failed',
          checkedAt: new Date().toISOString(),
          message,
        };
        setHealth(nextHealth);
        await saveConnectionHealth(storage, nextHealth);
        throw error;
      }
    },
    [resolveApi, storage],
  );

  const loadProjects = useCallback(
    async (credentials?: LiveConnectionCredentials) => {
      const client = await resolveApi(credentials);

      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const result = await client.listProjects();
        setProjects(result.data);
        return result.data;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load projects';
        setProjectsError(message);
        throw error;
      } finally {
        setProjectsLoading(false);
      }
    },
    [resolveApi],
  );

  const setActiveProject = useCallback(
    async (projectName: string | undefined) => {
      if (!settings.organization.trim()) {
        throw new Error('Save your organization before selecting a project.');
      }

      const next: AdoPersistedSettings = {
        ...settings,
        project: projectName?.trim() || undefined,
      };
      setSettings(next);
      await savePersistedSettings(storage, next);
      rebuildApi({
        organization: next.organization,
        project: next.project,
        apiVersion: next.apiVersion,
      });
    },
    [rebuildApi, settings, storage],
  );

  const setThemePreference = useCallback(
    async (theme: ThemePreference) => {
      const next = { ...settings, theme };
      setSettings(next);
      await savePersistedSettings(storage, next);
    },
    [settings, storage],
  );

  const value = useMemo<ConnectionContextValue>(
    () => ({
      hydrated,
      settings,
      pat: '',
      hasServerPat,
      health,
      recentRequests,
      projects,
      projectsError,
      projectsLoading,
      api,
      isConfigured: Boolean(settings.organization && hasServerPat),
      saveConfiguration,
      resetConfiguration,
      clearRecentRequests,
      testConnection,
      loadProjects,
      setActiveProject,
      setThemePreference,
    }),
    [
      hydrated,
      settings,
      hasServerPat,
      health,
      recentRequests,
      projects,
      projectsError,
      projectsLoading,
      api,
      saveConfiguration,
      resetConfiguration,
      clearRecentRequests,
      testConnection,
      loadProjects,
      setActiveProject,
      setThemePreference,
    ],
  );

  return (
    <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return ctx;
}

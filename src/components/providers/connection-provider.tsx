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
  clearPersistedSession,
  loadPersistedSession,
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
import { ADO_API } from '@core/constants';
import { createFetchHttpClient, createLocalStorageAdapter } from '@/lib/adapters';

interface ConnectionContextValue {
  hydrated: boolean;
  settings: AdoPersistedSettings;
  pat: string;
  health: ConnectionHealth;
  recentRequests: RequestInspectionRecord[];
  projects: TeamProjectReference[];
  projectsError: string | null;
  projectsLoading: boolean;
  api: AzureDevOpsApi | null;
  isConfigured: boolean;
  setPat: (value: string) => void;
  saveConfiguration: (input: {
    organization: string;
    project?: string;
    apiVersion: string;
    pat: string;
    rememberPat: boolean;
    theme?: ThemePreference;
  }) => Promise<void>;
  resetConfiguration: () => Promise<void>;
  testConnection: () => Promise<{ projectCount: number }>;
  loadProjects: () => Promise<TeamProjectReference[]>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

const EMPTY_SETTINGS: AdoPersistedSettings = {
  organization: '',
  apiVersion: ADO_API.DEFAULT_VERSION,
  theme: 'system',
  rememberPat: false,
};

function createApi(params: {
  organization: string;
  project?: string;
  apiVersion: string;
  pat: string;
  onRequestComplete: (record: RequestInspectionRecord) => void;
}): AzureDevOpsApi {
  return new AzureDevOpsApi({
    http: createFetchHttpClient(),
    organization: params.organization,
    project: params.project,
    apiVersion: params.apiVersion,
    pat: params.pat,
    proxyBaseUrl: '/api/ado',
    onRequestComplete: params.onRequestComplete,
  });
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const storage = useMemo(() => createLocalStorageAdapter(), []);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AdoPersistedSettings>(EMPTY_SETTINGS);
  const [pat, setPatState] = useState('');
  const [health, setHealth] = useState<ConnectionHealth>({ status: 'unconfigured' });
  const [recentRequests, setRecentRequests] = useState<RequestInspectionRecord[]>([]);
  const [projects, setProjects] = useState<TeamProjectReference[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [api, setApi] = useState<AzureDevOpsApi | null>(null);

  const pushInspection = useCallback((record: RequestInspectionRecord) => {
    setRecentRequests((prev) => [record, ...prev].slice(0, 25));
  }, []);

  const rebuildApi = useCallback(
    (next: {
      organization: string;
      project?: string;
      apiVersion: string;
      pat: string;
    }) => {
      if (!next.organization || !next.pat) {
        setApi(null);
        return null;
      }
      const instance = createApi({ ...next, onRequestComplete: pushInspection });
      setApi(instance);
      return instance;
    },
    [pushInspection],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await loadPersistedSession(storage);
      if (cancelled) return;

      setSettings(session.settings);
      setPatState(session.pat ?? '');
      setHealth(session.connection);
      rebuildApi({
        organization: session.settings.organization,
        project: session.settings.project,
        apiVersion: session.settings.apiVersion,
        pat: session.pat ?? '',
      });
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [rebuildApi, storage]);

  const setPat = useCallback((value: string) => {
    setPatState(value);
  }, []);

  const saveConfiguration: ConnectionContextValue['saveConfiguration'] = useCallback(
    async (input) => {
      const nextSettings: AdoPersistedSettings = {
        organization: input.organization.trim(),
        project: input.project?.trim() || undefined,
        apiVersion: input.apiVersion.trim() || ADO_API.DEFAULT_VERSION,
        theme: input.theme ?? settings.theme,
        rememberPat: input.rememberPat,
      };

      await savePersistedSettings(storage, nextSettings, input.pat);
      setSettings(nextSettings);
      setPatState(input.pat);
      rebuildApi({
        organization: nextSettings.organization,
        project: nextSettings.project,
        apiVersion: nextSettings.apiVersion,
        pat: input.pat,
      });

      if (!nextSettings.organization) {
        setHealth({ status: 'unconfigured' });
      } else if (health.status === 'unconfigured') {
        setHealth({ status: 'unknown' });
      }
    },
    [health.status, rebuildApi, settings.theme, storage],
  );

  const resetConfiguration = useCallback(async () => {
    await clearPersistedSession(storage);
    setSettings(EMPTY_SETTINGS);
    setPatState('');
    setHealth({ status: 'unconfigured' });
    setProjects([]);
    setProjectsError(null);
    setApi(null);
  }, [storage]);

  const testConnection = useCallback(async () => {
    if (!api) {
      throw new Error('Save organization and PAT before testing the connection.');
    }

    try {
      const result = await api.testConnection();
      const nextHealth: ConnectionHealth = {
        status: 'connected',
        checkedAt: new Date().toISOString(),
        message: `Connected — ${result.data.projectCount} project(s) visible`,
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
  }, [api, storage]);

  const loadProjects = useCallback(async () => {
    if (!api) {
      throw new Error('Save organization and PAT before loading projects.');
    }

    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await api.listProjects();
      setProjects(result.data);
      return result.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects';
      setProjectsError(message);
      throw error;
    } finally {
      setProjectsLoading(false);
    }
  }, [api]);

  const setThemePreference = useCallback(
    async (theme: ThemePreference) => {
      const next = { ...settings, theme };
      setSettings(next);
      await savePersistedSettings(storage, next, settings.rememberPat ? pat : null);
    },
    [pat, settings, storage],
  );

  const value = useMemo<ConnectionContextValue>(
    () => ({
      hydrated,
      settings,
      pat,
      health,
      recentRequests,
      projects,
      projectsError,
      projectsLoading,
      api,
      isConfigured: Boolean(settings.organization && pat),
      setPat,
      saveConfiguration,
      resetConfiguration,
      testConnection,
      loadProjects,
      setThemePreference,
    }),
    [
      hydrated,
      settings,
      pat,
      health,
      recentRequests,
      projects,
      projectsError,
      projectsLoading,
      api,
      setPat,
      saveConfiguration,
      resetConfiguration,
      testConnection,
      loadProjects,
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

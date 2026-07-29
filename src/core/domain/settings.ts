import type { StorageAdapter } from '../ports/storage';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { ADO_API } from '../constants/api';
import { adoPersistedSettingsSchema, type AdoPersistedSettings } from '../schemas/config';
import type { ConnectionHealth, ThemePreference } from '../types/config';

export interface LoadedAppSession {
  settings: AdoPersistedSettings;
  /** Present only when Remember PAT is enabled and a value was stored. */
  pat: string | null;
  connection: ConnectionHealth;
}

const DEFAULT_SETTINGS: AdoPersistedSettings = {
  organization: '',
  apiVersion: ADO_API.DEFAULT_VERSION,
  theme: 'system',
  rememberPat: false,
};

export async function loadPersistedSession(
  storage: StorageAdapter,
): Promise<LoadedAppSession> {
  const raw = await storage.getItem(STORAGE_KEYS.ORGANIZATION);
  const project = (await storage.getItem(STORAGE_KEYS.PROJECT)) ?? undefined;
  const apiVersion =
    (await storage.getItem(STORAGE_KEYS.API_VERSION)) ?? ADO_API.DEFAULT_VERSION;
  const theme = ((await storage.getItem(STORAGE_KEYS.THEME)) ??
    'system') as ThemePreference;
  const rememberPat = (await storage.getItem(STORAGE_KEYS.REMEMBER_PAT)) === 'true';
  const pat = rememberPat ? await storage.getItem(STORAGE_KEYS.PAT) : null;

  const connectionRaw = await storage.getItem(STORAGE_KEYS.CONNECTION_STATUS);
  let connection: ConnectionHealth = { status: 'unconfigured' };
  if (connectionRaw) {
    try {
      connection = JSON.parse(connectionRaw) as ConnectionHealth;
    } catch {
      connection = { status: 'unknown' };
    }
  }

  const parsed = adoPersistedSettingsSchema.safeParse({
    organization: raw ?? '',
    project: project && project.length > 0 ? project : undefined,
    apiVersion,
    theme,
    rememberPat,
  });

  return {
    settings: parsed.success ? parsed.data : { ...DEFAULT_SETTINGS },
    pat,
    connection:
      parsed.success && parsed.data.organization
        ? connection.status === 'unconfigured'
          ? { status: 'unknown' }
          : connection
        : { status: 'unconfigured' },
  };
}

export async function savePersistedSettings(
  storage: StorageAdapter,
  settings: AdoPersistedSettings,
  pat: string | null,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.ORGANIZATION, settings.organization);
  if (settings.project) {
    await storage.setItem(STORAGE_KEYS.PROJECT, settings.project);
  } else {
    await storage.removeItem(STORAGE_KEYS.PROJECT);
  }
  await storage.setItem(STORAGE_KEYS.API_VERSION, settings.apiVersion);
  await storage.setItem(STORAGE_KEYS.THEME, settings.theme);
  await storage.setItem(STORAGE_KEYS.REMEMBER_PAT, String(settings.rememberPat));

  if (settings.rememberPat && pat) {
    await storage.setItem(STORAGE_KEYS.PAT, pat);
  } else {
    await storage.removeItem(STORAGE_KEYS.PAT);
  }
}

export async function saveConnectionHealth(
  storage: StorageAdapter,
  health: ConnectionHealth,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.CONNECTION_STATUS, JSON.stringify(health));
}

export async function clearPersistedSession(storage: StorageAdapter): Promise<void> {
  await Promise.all([
    storage.removeItem(STORAGE_KEYS.ORGANIZATION),
    storage.removeItem(STORAGE_KEYS.PROJECT),
    storage.removeItem(STORAGE_KEYS.API_VERSION),
    storage.removeItem(STORAGE_KEYS.THEME),
    storage.removeItem(STORAGE_KEYS.REMEMBER_PAT),
    storage.removeItem(STORAGE_KEYS.PAT),
    storage.removeItem(STORAGE_KEYS.CONNECTION_STATUS),
  ]);
}

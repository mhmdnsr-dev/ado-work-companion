import type { StorageAdapter } from '../ports/storage';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { ADO_API } from '../constants/api';
import { adoPersistedSettingsSchema, type AdoPersistedSettings } from '../schemas/config';
import type { ConnectionHealth, ThemePreference } from '../types/config';

/**
 * Client localStorage holds non-secret connection prefs.
 * PAT lives only in an HttpOnly cookie set by POST /api/config.
 */

export async function loadPersistedSettings(
  storage: StorageAdapter,
): Promise<AdoPersistedSettings> {
  const organization = (await storage.getItem(STORAGE_KEYS.ORGANIZATION)) ?? '';
  const projectRaw = await storage.getItem(STORAGE_KEYS.PROJECT);
  const apiVersion =
    (await storage.getItem(STORAGE_KEYS.API_VERSION)) ?? ADO_API.DEFAULT_VERSION;
  const theme = ((await storage.getItem(STORAGE_KEYS.THEME)) ??
    'system') as ThemePreference;

  const parsed = adoPersistedSettingsSchema.safeParse({
    organization,
    project: projectRaw && projectRaw.length > 0 ? projectRaw : undefined,
    apiVersion,
    theme,
  });

  return parsed.success
    ? parsed.data
    : {
        organization: '',
        apiVersion: ADO_API.DEFAULT_VERSION,
        theme: 'system',
      };
}

export async function savePersistedSettings(
  storage: StorageAdapter,
  settings: AdoPersistedSettings,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.ORGANIZATION, settings.organization);
  if (settings.project) {
    await storage.setItem(STORAGE_KEYS.PROJECT, settings.project);
  } else {
    await storage.removeItem(STORAGE_KEYS.PROJECT);
  }
  await storage.setItem(STORAGE_KEYS.API_VERSION, settings.apiVersion);
  await storage.setItem(STORAGE_KEYS.THEME, settings.theme);
  // Never persist PAT or rememberPat leftovers.
  await storage.removeItem(STORAGE_KEYS.PAT);
  await storage.removeItem(STORAGE_KEYS.REMEMBER_PAT);
}

export async function loadConnectionHealth(
  storage: StorageAdapter,
): Promise<ConnectionHealth> {
  const connectionRaw = await storage.getItem(STORAGE_KEYS.CONNECTION_STATUS);
  if (!connectionRaw) return { status: 'unconfigured' };
  try {
    return JSON.parse(connectionRaw) as ConnectionHealth;
  } catch {
    return { status: 'unknown' };
  }
}

export async function saveConnectionHealth(
  storage: StorageAdapter,
  health: ConnectionHealth,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.CONNECTION_STATUS, JSON.stringify(health));
}

/** Wipe connection prefs + health (theme can be preserved by caller). */
export async function clearConnectionLocalState(
  storage: StorageAdapter,
  options?: { keepTheme?: boolean },
): Promise<void> {
  const theme = options?.keepTheme ? await storage.getItem(STORAGE_KEYS.THEME) : null;
  await Promise.all([
    storage.removeItem(STORAGE_KEYS.ORGANIZATION),
    storage.removeItem(STORAGE_KEYS.PROJECT),
    storage.removeItem(STORAGE_KEYS.API_VERSION),
    storage.removeItem(STORAGE_KEYS.REMEMBER_PAT),
    storage.removeItem(STORAGE_KEYS.PAT),
    storage.removeItem(STORAGE_KEYS.CONNECTION_STATUS),
  ]);
  if (theme) {
    await storage.setItem(STORAGE_KEYS.THEME, theme);
  }
}

export function emptyClientSettings(
  theme: ThemePreference = 'system',
): AdoPersistedSettings {
  return {
    organization: '',
    apiVersion: ADO_API.DEFAULT_VERSION,
    theme,
  };
}

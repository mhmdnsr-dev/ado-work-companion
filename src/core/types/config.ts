/**
 * Connection configuration for Azure DevOps.
 * Project is intentionally optional — org-only mode must remain fully usable.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export interface AdoConnectionConfig {
  organization: string;
  /** Empty string / undefined = organization-scoped mode. */
  project?: string;
  apiVersion: string;
  rememberPat: boolean;
}

export interface AdoRuntimeCredentials {
  pat: string;
}

export interface AdoAppSettings extends AdoConnectionConfig {
  theme: ThemePreference;
}

export type ConnectionStatus = 'unknown' | 'connected' | 'failed' | 'unconfigured';

export interface ConnectionHealth {
  status: ConnectionStatus;
  checkedAt?: string;
  message?: string;
  organizationName?: string;
}

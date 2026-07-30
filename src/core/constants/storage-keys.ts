/**
 * localStorage / AsyncStorage key names.
 * Kept in `core` so web and a future Expo client share identical keys.
 */
export const STORAGE_KEYS = {
  ORGANIZATION: 'ado.organization',
  PROJECT: 'ado.project',
  API_VERSION: 'ado.apiVersion',
  THEME: 'ado.theme',
  REMEMBER_PAT: 'ado.rememberPat',
  PAT: 'ado.pat',
  FAVORITES: 'ado.favorites',
  RECENT_REQUESTS: 'ado.recentRequests',
  CONNECTION_STATUS: 'ado.connectionStatus',
  WORK_ITEM_FILTERS: 'ado.workItemFilters',
  DASHBOARD_TEAM: 'ado.dashboardTeam',
  DASHBOARD_MEMBER: 'ado.dashboardMember',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

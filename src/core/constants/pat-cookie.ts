/**
 * How long the encrypted HttpOnly `ado_pat` cookie stays on this device.
 * This is not Azure DevOps PAT expiry — that is set in the ADO portal.
 */
export const PAT_COOKIE_LIFETIME_OPTIONS = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '14d', label: '14 days', days: 14 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  /**
   * Practical browser upper bound (~400 days in Chromium). Not literal forever.
   */
  { value: 'forever', label: 'Forever', days: 400 },
] as const;

export type PatCookieLifetime = (typeof PAT_COOKIE_LIFETIME_OPTIONS)[number]['value'];

export const DEFAULT_PAT_COOKIE_LIFETIME: PatCookieLifetime = '14d';

export function isPatCookieLifetime(value: unknown): value is PatCookieLifetime {
  return (
    typeof value === 'string' &&
    PAT_COOKIE_LIFETIME_OPTIONS.some((option) => option.value === value)
  );
}

/** Cookie Max-Age in seconds for the selected lifetime. */
export function patCookieMaxAgeSeconds(lifetime: PatCookieLifetime): number {
  const option = PAT_COOKIE_LIFETIME_OPTIONS.find((entry) => entry.value === lifetime);
  const days = option?.days ?? 14;
  return days * 60 * 60 * 24;
}

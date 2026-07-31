/**
 * Browser helpers for /api/config (PAT HttpOnly cookie only).
 * Org/project/apiVersion are stored in localStorage by the client.
 */

import {
  DEFAULT_PAT_COOKIE_LIFETIME,
  type PatCookieLifetime,
} from '@core/constants';
import { adoPatStatusSchema, type AdoPatStatus } from '@core/schemas';

async function parsePatStatus(response: Response): Promise<AdoPatStatus> {
  const json: unknown = await response.json().catch(() => null);
  const parsed = adoPatStatusSchema.safeParse(json);
  if (!response.ok) {
    const message =
      typeof json === 'object' &&
      json !== null &&
      'message' in json &&
      typeof (json as { message: unknown }).message === 'string'
        ? (json as { message: string }).message
        : `Config request failed (${response.status})`;
    throw new Error(message);
  }
  if (!parsed.success) {
    throw new Error('Unexpected config response from server.');
  }
  return parsed.data;
}

export async function fetchPatStatus(): Promise<AdoPatStatus> {
  const response = await fetch('/api/config', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  return parsePatStatus(response);
}

/** Set or replace the HttpOnly PAT cookie. Pass empty string to keep existing. */
export async function savePatCookie(
  pat: string,
  cookieLifetime: PatCookieLifetime = DEFAULT_PAT_COOKIE_LIFETIME,
): Promise<AdoPatStatus> {
  const response = await fetch('/api/config', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ pat, cookieLifetime }),
  });
  return parsePatStatus(response);
}

/** Clears the HttpOnly PAT cookie (Reset). */
export async function clearPatCookie(): Promise<AdoPatStatus> {
  const response = await fetch('/api/config', {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-store',
  });
  return parsePatStatus(response);
}

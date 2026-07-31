import { z } from 'zod';

import { ADO_API } from '../constants/api';
import { DEFAULT_PAT_COOKIE_LIFETIME } from '../constants/pat-cookie';

export const patCookieLifetimeSchema = z.enum([
  '7d',
  '14d',
  '30d',
  '90d',
  'forever',
]);

/**
 * Connection form schema (shared web + future mobile).
 * Org/project/apiVersion persist in localStorage; PAT is POSTed to /api/config only.
 * When an HttpOnly PAT cookie already exists, `pat` may be empty (keep existing).
 */
export const adoConnectionSchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, 'Organization is required')
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, 'Invalid organization name'),
  project: z.string(),
  apiVersion: z.string().trim().min(1, 'API version is required'),
  pat: z.string(),
  /** How long to keep the encrypted PAT cookie on this device. */
  patCookieLifetime: patCookieLifetimeSchema,
});

export type AdoConnectionFormValues = z.infer<typeof adoConnectionSchema>;

export function normalizeOptionalProject(
  project: string | undefined,
): string | undefined {
  const trimmed = project?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);

export const adoPersistedSettingsSchema = z.object({
  organization: z.string(),
  project: z.string().optional(),
  apiVersion: z.string().min(1).default(ADO_API.DEFAULT_VERSION),
  theme: themePreferenceSchema.default('system'),
  patCookieLifetime: patCookieLifetimeSchema.default(DEFAULT_PAT_COOKIE_LIFETIME),
});

export type AdoPersistedSettings = z.infer<typeof adoPersistedSettingsSchema>;

/** Response from /api/config — PAT never included. */
export const adoPatStatusSchema = z.object({
  hasPat: z.boolean(),
  configured: z.boolean().optional(),
  reset: z.boolean().optional(),
  kept: z.boolean().optional(),
  message: z.string().optional(),
});

export type AdoPatStatus = z.infer<typeof adoPatStatusSchema>;

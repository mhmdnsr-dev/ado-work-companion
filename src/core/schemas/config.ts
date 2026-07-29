import { z } from 'zod';

import { ADO_API } from '../constants/api';

/**
 * Connection form schema (shared web + future mobile).
 * `project` may be an empty string in the form; callers normalize to undefined.
 */
export const adoConnectionSchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, 'Organization is required')
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, 'Invalid organization name'),
  project: z.string(),
  apiVersion: z.string().trim().min(1, 'API version is required'),
  pat: z.string().min(1, 'Personal Access Token is required'),
  rememberPat: z.boolean(),
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
  organization: z.string().min(1),
  project: z.string().optional(),
  apiVersion: z.string().min(1).default(ADO_API.DEFAULT_VERSION),
  theme: themePreferenceSchema.default('system'),
  rememberPat: z.boolean().default(false),
});

export type AdoPersistedSettings = z.infer<typeof adoPersistedSettingsSchema>;

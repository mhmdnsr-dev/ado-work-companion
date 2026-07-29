import { z } from 'zod';

import { ADO_API } from '../constants/api';

/**
 * Connection form schema (shared web + future mobile).
 * Project is optional by design.
 */
export const adoConnectionSchema = z.object({
  organization: z
    .string()
    .trim()
    .min(1, 'Organization is required')
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, 'Invalid organization name'),
  project: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  apiVersion: z
    .string()
    .trim()
    .min(1, 'API version is required')
    .default(ADO_API.DEFAULT_VERSION),
  pat: z.string().min(1, 'Personal Access Token is required'),
  rememberPat: z.boolean().default(false),
});

export type AdoConnectionFormValues = z.infer<typeof adoConnectionSchema>;

export const themePreferenceSchema = z.enum(['light', 'dark', 'system']);

export const adoPersistedSettingsSchema = z.object({
  organization: z.string().min(1),
  project: z.string().optional(),
  apiVersion: z.string().min(1),
  theme: themePreferenceSchema.default('system'),
  rememberPat: z.boolean().default(false),
});

export type AdoPersistedSettings = z.infer<typeof adoPersistedSettingsSchema>;

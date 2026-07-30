import { z } from 'zod';

import type { StorageAdapter } from '../ports/storage';
import { STORAGE_KEYS } from '../constants/storage-keys';

export const workItemFiltersSchema = z.object({
  organization: z.string(),
  project: z.string(),
  typeFilter: z.string().default('all'),
  stateFilter: z.enum(['open', 'all', 'closed']).default('open'),
  teamId: z.string().default(''),
  sprintPath: z.string().default(''),
  assignedTo: z.string().default('@Me'),
  search: z.string().default(''),
});

export type WorkItemFiltersState = z.infer<typeof workItemFiltersSchema>;

export function emptyWorkItemFilters(
  organization = '',
  project = '',
): WorkItemFiltersState {
  return {
    organization,
    project,
    typeFilter: 'all',
    stateFilter: 'open',
    teamId: '',
    sprintPath: '',
    assignedTo: '@Me',
    search: '',
  };
}

export function parseWorkItemFilters(
  raw: string | null,
  organization: string,
  project: string,
): WorkItemFiltersState | null {
  if (!raw) return null;

  try {
    const parsed = workItemFiltersSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    if (
      parsed.data.organization !== organization.trim() ||
      parsed.data.project !== project.trim()
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export async function loadWorkItemFilters(
  storage: StorageAdapter,
  organization: string,
  project: string,
): Promise<WorkItemFiltersState | null> {
  const raw = await storage.getItem(STORAGE_KEYS.WORK_ITEM_FILTERS);
  return parseWorkItemFilters(raw, organization, project);
}

export async function saveWorkItemFilters(
  storage: StorageAdapter,
  filters: WorkItemFiltersState,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.WORK_ITEM_FILTERS, JSON.stringify(filters));
}

export async function clearWorkItemFilters(storage: StorageAdapter): Promise<void> {
  await storage.removeItem(STORAGE_KEYS.WORK_ITEM_FILTERS);
}

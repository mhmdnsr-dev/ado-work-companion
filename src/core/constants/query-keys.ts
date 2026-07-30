/**
 * TanStack Query keys — shared by web and a future Expo client.
 */
export const adoQueryKeys = {
  projects: {
    all: ['ado', 'projects'] as const,
    list: (organization: string, stateFilter: string) =>
      [...adoQueryKeys.projects.all, 'list', organization, stateFilter] as const,
    detail: (organization: string, projectIdOrName: string) =>
      [...adoQueryKeys.projects.all, 'detail', organization, projectIdOrName] as const,
  },
} as const;

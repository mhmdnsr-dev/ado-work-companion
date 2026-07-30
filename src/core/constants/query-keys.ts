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
  workItems: {
    all: ['ado', 'work-items'] as const,
    list: (organization: string, project: string, filters: Record<string, string>) =>
      [...adoQueryKeys.workItems.all, 'list', organization, project, filters] as const,
    detail: (organization: string, id: number) =>
      [...adoQueryKeys.workItems.all, 'detail', organization, id] as const,
    revisions: (organization: string, id: number) =>
      [...adoQueryKeys.workItems.all, 'revisions', organization, id] as const,
    comments: (organization: string, id: number) =>
      [...adoQueryKeys.workItems.all, 'comments', organization, id] as const,
    meta: {
      teams: (organization: string, project: string) =>
        [...adoQueryKeys.workItems.all, 'meta', 'teams', organization, project] as const,
      members: (organization: string, project: string, team: string) =>
        [
          ...adoQueryKeys.workItems.all,
          'meta',
          'members',
          organization,
          project,
          team,
        ] as const,
      iterations: (organization: string, project: string, team: string) =>
        [
          ...adoQueryKeys.workItems.all,
          'meta',
          'iterations',
          organization,
          project,
          team,
        ] as const,
      teamSettings: (organization: string, project: string, team: string) =>
        [
          ...adoQueryKeys.workItems.all,
          'meta',
          'team-settings',
          organization,
          project,
          team,
        ] as const,
      classification: (
        organization: string,
        project: string,
        group: 'areas' | 'iterations',
      ) =>
        [
          ...adoQueryKeys.workItems.all,
          'meta',
          'classification',
          organization,
          project,
          group,
        ] as const,
      states: (organization: string, project: string, type: string) =>
        [
          ...adoQueryKeys.workItems.all,
          'meta',
          'states',
          organization,
          project,
          type,
        ] as const,
      types: (organization: string, project: string) =>
        [...adoQueryKeys.workItems.all, 'meta', 'types', organization, project] as const,
      relationTypes: (organization: string) =>
        [...adoQueryKeys.workItems.all, 'meta', 'relation-types', organization] as const,
      linkCandidates: (organization: string, project: string, search = '') =>
        [
          ...adoQueryKeys.workItems.all,
          'meta',
          'link-candidates',
          organization,
          project,
          search,
        ] as const,
    },
  },
  dashboard: {
    all: ['ado', 'dashboard'] as const,
    teams: (organization: string, project: string) =>
      [...adoQueryKeys.dashboard.all, 'teams', organization, project] as const,
    currentSprint: (organization: string, project: string, team: string) =>
      [
        ...adoQueryKeys.dashboard.all,
        'current-sprint',
        organization,
        project,
        team,
      ] as const,
    burndown: (organization: string, project: string, team: string) =>
      [...adoQueryKeys.dashboard.all, 'burndown', organization, project, team] as const,
    members: (organization: string, project: string, team: string) =>
      [...adoQueryKeys.dashboard.all, 'members', organization, project, team] as const,
    currentUser: (organization: string) =>
      [...adoQueryKeys.dashboard.all, 'current-user', organization] as const,
  },
} as const;

import type { Page, Route } from '@playwright/test';

export const MOCK_ORG = 'contoso';
export const MOCK_PROJECT = 'Mock Project';
export const MOCK_API_VERSION = '7.2-preview';

const ALEX = {
  id: 'user-1',
  displayName: 'Alex Doe',
  uniqueName: 'alex@example.com',
};
const BLAIR = {
  id: 'user-2',
  displayName: 'Blair Smith',
  uniqueName: 'blair@example.com',
};

const TEAMS = [
  {
    id: 'team-alpha',
    name: 'Team Alpha',
    projectName: MOCK_PROJECT,
    description: 'Alpha team',
  },
  {
    id: 'team-beta',
    name: 'Team Beta',
    projectName: MOCK_PROJECT,
    description: 'Beta team',
  },
];

const MEMBERS = [{ identity: ALEX }, { identity: BLAIR }];

const PROJECTS = [
  { id: 'project-alpha', name: 'Alpha Project', state: 'wellFormed' },
  { id: 'project-beta', name: 'Beta Project', state: 'wellFormed' },
];

const WORK_ITEM_TYPES = [
  { name: 'Task', description: 'A unit of work' },
  { name: 'Bug', description: 'A defect' },
  { name: 'User Story', description: 'A user-facing story' },
];

const CURRENT_SPRINT = {
  id: 'sprint-current',
  name: 'Sprint Current',
  path: `${MOCK_PROJECT}\\Sprint Current`,
  attributes: {
    startDate: '2026-10-01T00:00:00Z',
    finishDate: '2026-11-11T00:00:00Z',
    timeFrame: 'current',
  },
};

const FUTURE_SPRINT = {
  id: 'sprint-future',
  name: 'Sprint Future',
  path: `${MOCK_PROJECT}\\Sprint Future`,
  attributes: {
    startDate: '2026-11-12T00:00:00Z',
    finishDate: '2026-12-23T00:00:00Z',
    timeFrame: 'future',
  },
};

const ITERATION_TREE = {
  id: 1,
  name: MOCK_PROJECT,
  structureType: 'iteration',
  children: [
    {
      id: 10,
      name: CURRENT_SPRINT.name,
      structureType: 'iteration',
      attributes: CURRENT_SPRINT.attributes,
    },
    {
      id: 11,
      name: FUTURE_SPRINT.name,
      structureType: 'iteration',
      attributes: FUTURE_SPRINT.attributes,
    },
  ],
};

const TEAM_SETTINGS = {
  teamFieldValues: [{ value: MOCK_PROJECT, includeChildren: true }],
  defaultIteration: CURRENT_SPRINT,
};

interface MockWorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations: Array<{ rel: string; url: string }>;
}

function relationUrl(id: number): string {
  return `https://dev.azure.com/${MOCK_ORG}/_apis/wit/workItems/${id}`;
}

function parentRelation(id: number) {
  return {
    rel: 'System.LinkTypes.Hierarchy-Reverse',
    url: relationUrl(id),
  };
}

function childRelation(id: number) {
  return {
    rel: 'System.LinkTypes.Hierarchy-Forward',
    url: relationUrl(id),
  };
}

function fields(params: {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo: typeof ALEX | typeof BLAIR;
  changedDate: string;
  remainingWork: number;
}) {
  return {
    'System.Id': params.id,
    'System.Title': params.title,
    'System.WorkItemType': params.type,
    'System.State': params.state,
    'System.AssignedTo': params.assignedTo,
    'System.ChangedDate': params.changedDate,
    'System.CreatedDate': params.changedDate,
    'System.TeamProject': MOCK_PROJECT,
    'System.AreaPath': MOCK_PROJECT,
    'System.IterationPath': `${MOCK_PROJECT}\\Sprint Current`,
    'Microsoft.VSTS.Common.Priority': 2,
    'Microsoft.VSTS.Scheduling.RemainingWork': params.remainingWork,
  };
}

const WORK_ITEMS: Record<number, MockWorkItem> = {
  101: {
    id: 101,
    fields: fields({
      id: 101,
      title: 'Implement search',
      type: 'Task',
      state: 'Active',
      assignedTo: ALEX,
      changedDate: '2026-01-03T00:00:00Z',
      remainingWork: 4,
    }),
    relations: [parentRelation(201)],
  },
  102: {
    id: 102,
    fields: fields({
      id: 102,
      title: 'Fix login',
      type: 'Bug',
      state: 'New',
      assignedTo: ALEX,
      changedDate: '2026-01-02T00:00:00Z',
      remainingWork: 2,
    }),
    relations: [parentRelation(202)],
  },
  201: {
    id: 201,
    fields: fields({
      id: 201,
      title: 'Search experience',
      type: 'User Story',
      state: 'Active',
      assignedTo: ALEX,
      changedDate: '2026-01-05T00:00:00Z',
      remainingWork: 0,
    }),
    // 999 is intentionally missing from the batch response. It exercises the
    // null-entry guard when Azure omits a deleted/missing linked work item.
    relations: [childRelation(101), childRelation(301), childRelation(999)],
  },
  202: {
    id: 202,
    fields: fields({
      id: 202,
      title: 'Authentication',
      type: 'User Story',
      state: 'Active',
      assignedTo: ALEX,
      changedDate: '2026-01-04T00:00:00Z',
      remainingWork: 0,
    }),
    relations: [childRelation(102), childRelation(302), childRelation(303)],
  },
  301: {
    id: 301,
    fields: fields({
      id: 301,
      title: 'QA search',
      type: 'Task',
      state: 'New',
      assignedTo: BLAIR,
      changedDate: '2026-01-01T00:00:00Z',
      remainingWork: 3,
    }),
    relations: [parentRelation(201)],
  },
  302: {
    id: 302,
    fields: fields({
      id: 302,
      title: 'Write auth tests',
      type: 'Task',
      state: 'New',
      assignedTo: BLAIR,
      changedDate: '2025-12-31T00:00:00Z',
      remainingWork: 5,
    }),
    relations: [parentRelation(202)],
  },
  303: {
    id: 303,
    fields: fields({
      id: 303,
      title: 'Token refresh',
      type: 'Bug',
      state: 'Active',
      assignedTo: BLAIR,
      changedDate: '2025-12-30T00:00:00Z',
      remainingWork: 1,
    }),
    relations: [parentRelation(202)],
  },
};

const WIQL_RESULT = {
  queryType: 'flat',
  queryResultType: 'workitem',
  asOf: '2026-01-06T00:00:00Z',
  workItems: [{ id: 101 }, { id: 102 }],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, json: body });
}

function workItemsForIds(ids: number[]): Array<MockWorkItem | null> {
  return ids.map((id) => WORK_ITEMS[id] ?? null);
}

/**
 * Routes every Azure DevOps request made by the app through deterministic mock
 * data. The tests never need a real PAT or network access to Azure DevOps.
 */
export async function installAdoMocks(page: Page) {
  await page.route('**/api/ado/**', async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname);

    if (path.includes('/_apis/connectiondata')) {
      return json(route, { authenticatedUser: ALEX });
    }

    if (path.includes('/_apis/wit/workitemtypes/') && path.endsWith('/states')) {
      return json(route, {
        count: 4,
        value: [
          { name: 'New', color: 'b2b2b2', category: 'Proposed' },
          { name: 'Active', color: '007acc', category: 'InProgress' },
          { name: 'Resolved', color: 'ff9d00', category: 'Resolved' },
          { name: 'Closed', color: '339933', category: 'Completed' },
        ],
      });
    }

    if (path.includes('/_apis/wit/workitemtypes')) {
      return json(route, { count: WORK_ITEM_TYPES.length, value: WORK_ITEM_TYPES });
    }

    if (path.includes('/_apis/wit/classificationnodes/iterations')) {
      return json(route, ITERATION_TREE);
    }

    if (
      path.includes('/_apis/work/teamsettings/iterations/') &&
      path.endsWith('/workitems')
    ) {
      return json(route, { workItemRelations: [] });
    }

    if (path.includes('/_apis/work/teamsettings/iterations')) {
      return json(route, {
        count: 2,
        value: [CURRENT_SPRINT, FUTURE_SPRINT],
      });
    }

    if (path.endsWith('/_apis/work/teamsettings')) {
      return json(route, TEAM_SETTINGS);
    }

    if (path.includes('/_apis/wit/wiql')) {
      return json(route, WIQL_RESULT);
    }

    if (path.includes('/_apis/wit/workitems')) {
      const idsParam = url.searchParams.get('ids');
      if (idsParam) {
        const ids = idsParam
          .split(',')
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0);
        return json(route, {
          count: ids.length,
          value: workItemsForIds(ids),
        });
      }

      const singleMatch = /\/workitems\/(\d+)$/.exec(path);
      const singleId = singleMatch ? Number(singleMatch[1]) : NaN;
      const singleItem = Number.isInteger(singleId) ? WORK_ITEMS[singleId] : undefined;
      if (singleItem) return json(route, singleItem);
      return json(route, { message: 'Work item not found' }, 404);
    }

    if (
      path.includes('/_apis/projects/') &&
      path.includes('/teams/') &&
      path.endsWith('/members')
    ) {
      return json(route, { count: MEMBERS.length, value: MEMBERS });
    }

    if (path.includes('/_apis/projects/') && path.endsWith('/teams')) {
      return json(route, { count: TEAMS.length, value: TEAMS });
    }

    if (path.endsWith('/_apis/projects')) {
      return json(route, { count: PROJECTS.length, value: PROJECTS });
    }

    return json(route, { count: 0, value: [] });
  });

  await page.route('**/api/analytics/**', async (route) => {
    return json(route, { count: 0, value: [] });
  });
}

/**
 * Authenticates the browser context with the real local config route using a
 * fake PAT, then stores the same organization/project the mocks expect. The
 * fake PAT never reaches Azure DevOps because /api/ado/** is intercepted.
 */
export async function configureMockConnection(
  page: Page,
  options: { organization?: string; project?: string } = {},
) {
  const organization = options.organization ?? MOCK_ORG;
  const project = options.project ?? MOCK_PROJECT;

  await page.goto('/help');
  await page.evaluate(
    ({ org, nextProject }) => {
      localStorage.setItem('ado.organization', org);
      localStorage.setItem('ado.apiVersion', '7.2-preview');
      if (nextProject) localStorage.setItem('ado.project', nextProject);
      else localStorage.removeItem('ado.project');
    },
    { org: organization, nextProject: project },
  );

  const response = await page.request.post('/api/config', {
    data: { pat: 'mock-playwright-pat', cookieLifetime: '14d' },
  });
  if (!response.ok()) {
    throw new Error(`Could not configure mock connection: HTTP ${response.status()}`);
  }
}

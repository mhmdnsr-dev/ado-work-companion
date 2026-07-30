import type { AdoListResponse } from '../../types/projects';
import type {
  IterationWorkItems,
  TeamMember,
  TeamSetting,
  TeamSettingsIteration,
  WebApiTeam,
  WorkItemClassificationNode,
  WorkItemField,
  WorkItemRelationType,
  WorkItemStateColor,
  WorkItemType,
} from '../../types/metadata';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';

/**
 * Lists teams in a project.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-teams?view=azure-devops-rest-7.2
 */
export async function listTeams(
  transport: AdoTransport,
  options: {
    project: string;
    top?: number;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WebApiTeam[]>> {
  const project = options.project.trim();
  const result = await transport.request<AdoListResponse<WebApiTeam>>({
    method: 'GET',
    path: `_apis/projects/${encodeURIComponent(project)}/teams`,
    project: null,
    query: { $top: options.top ?? 100 },
    signal: options.signal,
    retry: true,
  });
  return { data: result.data.value ?? [], inspection: result.inspection };
}

/**
 * Lists members of a team (for assignee / @mention suggestions).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-team-members-with-extended-properties?view=azure-devops-rest-7.2
 */
export async function listTeamMembers(
  transport: AdoTransport,
  options: {
    project: string;
    team: string;
    top?: number;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<TeamMember[]>> {
  const project = options.project.trim();
  const team = options.team.trim();
  const result = await transport.request<AdoListResponse<TeamMember>>({
    method: 'GET',
    path: `_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team)}/members`,
    project: null,
    query: { $top: options.top ?? 200 },
    signal: options.signal,
    retry: true,
  });
  return { data: result.data.value ?? [], inspection: result.inspection };
}

/**
 * Team board settings (area paths used for team filtering).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/work/teamsettings/get?view=azure-devops-rest-7.2
 */
export async function getTeamSettings(
  transport: AdoTransport,
  options: {
    project: string;
    team: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<TeamSetting>> {
  return transport.request<TeamSetting>({
    method: 'GET',
    path: '_apis/work/teamsettings',
    project: options.project,
    team: options.team,
    signal: options.signal,
    retry: true,
  });
}

/**
 * Team iterations / sprints.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.2
 */
export async function listTeamIterations(
  transport: AdoTransport,
  options: {
    project: string;
    team: string;
    timeframe?: 'current' | 'past' | 'future';
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<TeamSettingsIteration[]>> {
  const result = await transport.request<AdoListResponse<TeamSettingsIteration>>({
    method: 'GET',
    path: '_apis/work/teamsettings/iterations',
    project: options.project,
    team: options.team,
    query: { $timeframe: options.timeframe },
    signal: options.signal,
    retry: true,
  });
  return { data: result.data.value ?? [], inspection: result.inspection };
}

/**
 * Work items assigned to a team iteration.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/get-iteration-work-items
 */
export async function getIterationWorkItems(
  transport: AdoTransport,
  options: {
    project: string;
    team: string;
    iterationId: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<IterationWorkItems>> {
  return transport.request<IterationWorkItems>({
    method: 'GET',
    path: `_apis/work/teamsettings/iterations/${options.iterationId}/workitems`,
    project: options.project,
    team: options.team,
    signal: options.signal,
    retry: true,
  });
}

/**
 * Project iteration or area tree.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/classification-nodes/get-classification-nodes?view=azure-devops-rest-7.2
 */
export async function getClassificationNode(
  transport: AdoTransport,
  options: {
    project: string;
    structureGroup: 'areas' | 'iterations';
    depth?: number;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemClassificationNode>> {
  return transport.request<WorkItemClassificationNode>({
    method: 'GET',
    path: `_apis/wit/classificationnodes/${options.structureGroup}`,
    project: options.project,
    query: { $depth: options.depth ?? 5 },
    signal: options.signal,
    retry: true,
  });
}

/**
 * Allowed states for a work item type.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-types/list?view=azure-devops-rest-7.2
 */
export async function listWorkItemTypeStates(
  transport: AdoTransport,
  options: {
    project: string;
    type: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemStateColor[]>> {
  const type = options.type.trim();
  const result = await transport.request<AdoListResponse<WorkItemStateColor>>({
    method: 'GET',
    path: `_apis/wit/workitemtypes/${encodeURIComponent(type)}/states`,
    project: options.project,
    signal: options.signal,
    retry: true,
  });
  return { data: result.data.value ?? [], inspection: result.inspection };
}

/**
 * Lists work item types defined in the project process.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-types/list?view=azure-devops-rest-7.2
 */
export async function listWorkItemTypes(
  transport: AdoTransport,
  options: {
    project: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemType[]>> {
  const result = await transport.request<AdoListResponse<WorkItemType>>({
    method: 'GET',
    path: '_apis/wit/workitemtypes',
    project: options.project,
    signal: options.signal,
    retry: true,
  });
  return {
    data: (result.data.value ?? []).filter((type) => !type.isDisabled),
    inspection: result.inspection,
  };
}

/**
 * Lists work item fields available to the project (or organization when project is null).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/fields/list?view=azure-devops-rest-7.2
 */
export async function listWorkItemFields(
  transport: AdoTransport,
  options?: {
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemField[]>> {
  const result = await transport.request<AdoListResponse<WorkItemField>>({
    method: 'GET',
    path: '_apis/wit/fields',
    project: options?.project === undefined ? transport.getProject() : options.project,
    signal: options?.signal,
    retry: true,
  });
  return {
    data: (result.data.value ?? []).filter((field) => !field.isDeleted),
    inspection: result.inspection,
  };
}

/**
 * Lists work item relation (link) types for the organization.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-relation-types/list?view=azure-devops-rest-7.2
 */
export async function listWorkItemRelationTypes(
  transport: AdoTransport,
  options?: {
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemRelationType[]>> {
  const result = await transport.request<AdoListResponse<WorkItemRelationType>>({
    method: 'GET',
    path: '_apis/wit/workitemrelationtypes',
    project: null,
    signal: options?.signal,
    retry: true,
  });
  return { data: result.data.value ?? [], inspection: result.inspection };
}

import { AdoClientError } from '../../types/errors';
import type {
  AdoListResponse,
  AuthenticatedUser,
  ConnectionData,
  TeamProject,
  TeamProjectReference,
} from '../../types/projects';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';

/**
 * Lists projects the authenticated user can access.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.2
 */
export async function listProjects(
  transport: AdoTransport,
  options?: {
    signal?: AbortSignal;
    stateFilter?: string;
    top?: number;
    skip?: number;
    getDefaultTeamImageUrl?: boolean;
  },
): Promise<AdoRequestResult<TeamProjectReference[]>> {
  const result = await transport.request<AdoListResponse<TeamProjectReference>>({
    method: 'GET',
    path: '_apis/projects',
    project: null,
    query: {
      stateFilter: options?.stateFilter ?? 'wellFormed',
      $top: options?.top ?? 1000,
      $skip: options?.skip,
      getDefaultTeamImageUrl: options?.getDefaultTeamImageUrl,
    },
    signal: options?.signal,
    retry: true,
  });

  return {
    data: result.data.value ?? [],
    inspection: result.inspection,
  };
}

/**
 * Returns the user authenticated by the current PAT.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/location/get-connection-data
 */
export async function getAuthenticatedUser(
  transport: AdoTransport,
  options?: {
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<AuthenticatedUser | null>> {
  const result = await transport.request<ConnectionData>({
    method: 'GET',
    path: '_apis/connectiondata',
    project: null,
    query: { 'api-version': '7.1-preview.1' },
    signal: options?.signal,
    retry: true,
  });
  return {
    data: result.data.authenticatedUser ?? null,
    inspection: result.inspection,
  };
}

/**
 * Gets a project by id or name, optionally including capabilities.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/get?view=azure-devops-rest-7.2
 */
export async function getProject(
  transport: AdoTransport,
  projectIdOrName: string,
  options?: {
    signal?: AbortSignal;
    includeCapabilities?: boolean;
    includeHistory?: boolean;
  },
): Promise<AdoRequestResult<TeamProject>> {
  const id = projectIdOrName.trim();
  if (!id) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Project id or name is required.',
      statusCode: null,
      retryable: false,
    });
  }

  return transport.request<TeamProject>({
    method: 'GET',
    path: `_apis/projects/${encodeURIComponent(id)}`,
    project: null,
    query: {
      includeCapabilities: options?.includeCapabilities ?? true,
      includeHistory: options?.includeHistory,
    },
    signal: options?.signal,
    retry: true,
  });
}

/**
 * Connection probe — uses Projects List (org-scoped, read-only).
 */
export async function testConnection(
  transport: AdoTransport,
  options?: { signal?: AbortSignal },
): Promise<
  AdoRequestResult<{
    projectCount: number;
    organization: string;
    projects: TeamProjectReference[];
  }>
> {
  const listed = await listProjects(transport, { signal: options?.signal });
  return {
    data: {
      projectCount: listed.data.length,
      organization: transport.getOrganization(),
      projects: listed.data,
    },
    inspection: listed.inspection,
  };
}

import { AdoClientError } from '../../types/errors';
import type { AdoListResponse } from '../../types/projects';
import type { QueryExpand, QueryHierarchyItem } from '../../types/queries';
import type { WorkItemQueryResult } from '../../types/work-items';
import { encodeQueryResourcePath } from '../request-helpers';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';

/**
 * Lists the root query folders (My Queries / Shared Queries) and descendants.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/queries/list?view=azure-devops-rest-7.2
 */
export async function listQueries(
  transport: AdoTransport,
  options?: {
    depth?: number;
    expand?: QueryExpand;
    includeDeleted?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<QueryHierarchyItem[]>> {
  const result = await transport.request<AdoListResponse<QueryHierarchyItem>>({
    method: 'GET',
    path: '_apis/wit/queries',
    project: options?.project === undefined ? transport.getProject() : options.project,
    query: {
      $depth: options?.depth ?? 2,
      $expand: options?.expand ?? 'None',
      $includeDeleted: options?.includeDeleted,
    },
    signal: options?.signal,
    retry: true,
  });

  return { data: result.data.value ?? [], inspection: result.inspection };
}

/**
 * Gets a saved query (or folder) by id or path.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/queries/get?view=azure-devops-rest-7.2
 */
export async function getQuery(
  transport: AdoTransport,
  options: {
    idOrPath: string;
    depth?: number;
    expand?: QueryExpand;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<QueryHierarchyItem>> {
  const idOrPath = options.idOrPath.trim();
  if (!idOrPath) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Query id or path is required.',
      retryable: false,
    });
  }

  return transport.request<QueryHierarchyItem>({
    method: 'GET',
    path: `_apis/wit/queries/${encodeQueryResourcePath(idOrPath)}`,
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      $depth: options.depth,
      $expand: options.expand ?? 'Wiql',
    },
    signal: options.signal,
    retry: true,
  });
}

/**
 * Runs a saved query by id and returns matching work item references.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-id?view=azure-devops-rest-7.2
 */
export async function queryById(
  transport: AdoTransport,
  options: {
    id: string;
    top?: number;
    timePrecision?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemQueryResult>> {
  const id = options.id.trim();
  if (!id) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Query id is required.',
      retryable: false,
    });
  }

  return transport.request<WorkItemQueryResult>({
    method: 'GET',
    path: `_apis/wit/wiql/${encodeURIComponent(id)}`,
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      $top: options.top ?? 200,
      timePrecision: options.timePrecision,
    },
    signal: options.signal,
    retry: true,
  });
}

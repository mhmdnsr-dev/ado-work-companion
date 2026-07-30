import { AdoClientError } from '../../types/errors';
import type { AdoListResponse } from '../../types/projects';
import type {
  JsonPatchOperation,
  WorkItem,
  WorkItemExpand,
  WorkItemQueryResult,
} from '../../types/work-items';
import { WORK_ITEM_LIST_FIELDS } from '../../types/work-items';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';

/**
 * Executes a WIQL query and returns matching work item references.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.2
 */
export async function queryByWiql(
  transport: AdoTransport,
  options: {
    query: string;
    top?: number;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemQueryResult>> {
  return transport.request<WorkItemQueryResult>({
    method: 'POST',
    path: '_apis/wit/wiql',
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      $top: options.top ?? 200,
    },
    body: { query: options.query },
    signal: options.signal,
    retry: false,
  });
}

/**
 * Gets one or more work items by id.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/list?view=azure-devops-rest-7.2
 */
export async function getWorkItems(
  transport: AdoTransport,
  options: {
    ids: number[];
    fields?: readonly string[];
    expand?: WorkItemExpand;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem[]>> {
  const ids = [...new Set(options.ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'At least one work item id is required.',
      retryable: false,
    });
  }

  const result = await transport.request<AdoListResponse<WorkItem>>({
    method: 'GET',
    path: '_apis/wit/workitems',
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      ids: ids.join(','),
      fields: (options.fields ?? WORK_ITEM_LIST_FIELDS).join(','),
      $expand: options.expand,
      errorPolicy: 'omit',
    },
    signal: options.signal,
    retry: true,
  });

  return { data: result.data.value ?? [], inspection: result.inspection };
}

/**
 * Gets a single work item.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get?view=azure-devops-rest-7.2
 */
export async function getWorkItem(
  transport: AdoTransport,
  options: {
    id: number;
    fields?: readonly string[];
    expand?: WorkItemExpand;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem>> {
  return transport.request<WorkItem>({
    method: 'GET',
    path: `_apis/wit/workitems/${options.id}`,
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      fields: options.fields?.join(','),
      $expand: options.expand ?? 'Relations',
    },
    signal: options.signal,
    retry: true,
  });
}

/**
 * Creates a work item (JSON Patch). Project is required.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create?view=azure-devops-rest-7.2
 */
export async function createWorkItem(
  transport: AdoTransport,
  options: {
    type: string;
    operations: JsonPatchOperation[];
    project: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem>> {
  const project = options.project.trim();
  if (!project) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Select a project before creating a work item.',
      retryable: false,
    });
  }

  const type = options.type.trim();
  if (!type) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Work item type is required.',
      retryable: false,
    });
  }

  return transport.request<WorkItem>({
    method: 'POST',
    path: `_apis/wit/workitems/$${encodeURIComponent(type)}`,
    project,
    body: options.operations,
    jsonPatch: true,
    signal: options.signal,
    retry: false,
  });
}

/**
 * Updates a work item (JSON Patch).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update?view=azure-devops-rest-7.2
 */
export async function updateWorkItem(
  transport: AdoTransport,
  options: {
    id: number;
    operations: JsonPatchOperation[];
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem>> {
  return transport.request<WorkItem>({
    method: 'PATCH',
    path: `_apis/wit/workitems/${options.id}`,
    project: options.project === undefined ? transport.getProject() : options.project,
    body: options.operations,
    jsonPatch: true,
    signal: options.signal,
    retry: false,
  });
}

/**
 * Deletes a work item (recycle bin unless destroy=true).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/delete?view=azure-devops-rest-7.2
 */
export async function deleteWorkItem(
  transport: AdoTransport,
  options: {
    id: number;
    destroy?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<unknown>> {
  return transport.request<unknown>({
    method: 'DELETE',
    path: `_apis/wit/workitems/${options.id}`,
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      destroy: options.destroy ?? false,
    },
    signal: options.signal,
    retry: false,
  });
}

/**
 * Lists work item revisions (history).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/revisions/list?view=azure-devops-rest-7.2
 */
export async function listWorkItemRevisions(
  transport: AdoTransport,
  options: {
    id: number;
    top?: number;
    skip?: number;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem[]>> {
  const result = await transport.request<AdoListResponse<WorkItem>>({
    method: 'GET',
    path: `_apis/wit/workitems/${options.id}/revisions`,
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      $top: options.top ?? 50,
      $skip: options.skip,
    },
    signal: options.signal,
    retry: true,
  });

  return { data: result.data.value ?? [], inspection: result.inspection };
}

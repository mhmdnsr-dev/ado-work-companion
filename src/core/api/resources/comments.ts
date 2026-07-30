import type {
  WorkItemComment,
  WorkItemCommentList,
} from '../../types/metadata';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';

/**
 * Lists comments on a work item.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/get-comments?view=azure-devops-rest-7.2
 */
export async function listWorkItemComments(
  transport: AdoTransport,
  options: {
    id: number;
    project: string;
    top?: number;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemComment[]>> {
  const result = await transport.request<WorkItemCommentList>({
    method: 'GET',
    path: `_apis/wit/workItems/${options.id}/comments`,
    project: options.project,
    query: {
      $top: options.top ?? 50,
      order: 'desc',
    },
    signal: options.signal,
    retry: true,
  });
  const comments = result.data.comments ?? result.data.value ?? [];
  return { data: comments, inspection: result.inspection };
}

/**
 * Adds a comment (HTML supported for @mentions).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add?view=azure-devops-rest-7.2
 */
export async function addWorkItemComment(
  transport: AdoTransport,
  options: {
    id: number;
    project: string;
    text: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItemComment>> {
  return transport.request<WorkItemComment>({
    method: 'POST',
    path: `_apis/wit/workItems/${options.id}/comments`,
    project: options.project,
    body: { text: options.text },
    signal: options.signal,
    retry: false,
  });
}

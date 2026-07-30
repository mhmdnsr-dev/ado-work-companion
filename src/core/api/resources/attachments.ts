import {
  ADO_API,
  ADO_MAX_SIMPLE_ATTACHMENT_BYTES,
  ADO_OCTET_STREAM_CONTENT_TYPE,
} from '../../constants/api';
import { AdoClientError } from '../../types/errors';
import type { WorkItem } from '../../types/work-items';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';
import { updateWorkItem } from './work-items';

/**
 * Uploads an attachment (simple upload).
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/attachments/create?view=azure-devops-rest-7.2
 */
export async function uploadAttachment(
  transport: AdoTransport,
  options: {
    fileName: string;
    content: ArrayBuffer | Blob;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<{ id: string; url: string }>> {
  const fileName = options.fileName.trim();
  if (!fileName) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Attachment file name is required.',
      retryable: false,
    });
  }

  const size =
    options.content instanceof Blob ? options.content.size : options.content.byteLength;
  if (size <= 0) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Attachment content is empty.',
      retryable: false,
    });
  }
  if (size > ADO_MAX_SIMPLE_ATTACHMENT_BYTES) {
    throw new AdoClientError({
      kind: 'validation',
      message: `Attachments larger than ${Math.floor(ADO_MAX_SIMPLE_ATTACHMENT_BYTES / (1024 * 1024))} MB are not supported in this upload flow.`,
      retryable: false,
    });
  }

  return transport.request<{ id: string; url: string }>({
    method: 'POST',
    path: '_apis/wit/attachments',
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      fileName,
      uploadType: 'Simple',
    },
    rawBody: options.content,
    rawContentType: ADO_OCTET_STREAM_CONTENT_TYPE,
    signal: options.signal,
    timeoutMs: Math.max(ADO_API.DEFAULT_TIMEOUT_MS, 120_000),
    retry: false,
  });
}

/**
 * Downloads an attachment by id.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/attachments/get?view=azure-devops-rest-7.2
 */
export async function downloadAttachment(
  transport: AdoTransport,
  options: {
    id: string;
    fileName?: string;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<
  AdoRequestResult<{
    buffer: ArrayBuffer;
    contentType?: string;
    contentDisposition?: string;
    fileName?: string;
  }>
> {
  const id = options.id.trim();
  if (!id) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Attachment id is required.',
      retryable: false,
    });
  }

  const result = await transport.request<{
    buffer: ArrayBuffer;
    contentType?: string;
    contentDisposition?: string;
  }>({
    method: 'GET',
    path: `_apis/wit/attachments/${encodeURIComponent(id)}`,
    project: options.project === undefined ? transport.getProject() : options.project,
    query: {
      fileName: options.fileName,
      download: true,
    },
    responseType: 'arrayBuffer',
    signal: options.signal,
    timeoutMs: Math.max(ADO_API.DEFAULT_TIMEOUT_MS, 120_000),
    retry: true,
  });

  return {
    data: {
      ...result.data,
      fileName: options.fileName,
    },
    inspection: result.inspection,
  };
}

/**
 * Uploads a file and links it to a work item as an AttachedFile relation.
 */
export async function attachFileToWorkItem(
  transport: AdoTransport,
  options: {
    workItemId: number;
    fileName: string;
    content: ArrayBuffer | Blob;
    comment?: string;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem>> {
  const uploaded = await uploadAttachment(transport, {
    fileName: options.fileName,
    content: options.content,
    project: options.project,
    signal: options.signal,
  });

  const attachmentUrl = uploaded.data.url?.includes('fileName=')
    ? uploaded.data.url
    : `${uploaded.data.url}${uploaded.data.url.includes('?') ? '&' : '?'}fileName=${encodeURIComponent(options.fileName)}`;

  const comment = options.comment?.trim();
  return updateWorkItem(transport, {
    id: options.workItemId,
    project: options.project,
    signal: options.signal,
    operations: [
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'AttachedFile',
          url: attachmentUrl,
          attributes: comment ? { comment } : undefined,
        },
      },
    ],
  });
}

/**
 * Removes an attachment relation from a work item by relation index.
 */
export async function detachWorkItemAttachment(
  transport: AdoTransport,
  options: {
    workItemId: number;
    relationIndex: number;
    project?: string | null;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<WorkItem>> {
  if (!Number.isInteger(options.relationIndex) || options.relationIndex < 0) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'A valid attachment relation index is required.',
      retryable: false,
    });
  }

  return updateWorkItem(transport, {
    id: options.workItemId,
    project: options.project,
    signal: options.signal,
    operations: [
      {
        op: 'remove',
        path: `/relations/${options.relationIndex}`,
      },
    ],
  });
}

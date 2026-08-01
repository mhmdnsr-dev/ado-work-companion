import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';
import {
  ESTIMATE_EXTENSION,
  ESTIMATE_EXT_DATA_API_VERSION,
  ESTIMATE_PUBLISHER,
} from '../../types/estimate-hub';
import { AdoClientError } from '../../types/errors';

export type EstimateChannelActionType =
  | 'join'
  | 'left'
  | 'estimate'
  | 'estimate-updated'
  | 'reveal'
  | 'switch'
  | 'snapshot';

export interface EstimateChannelAction {
  seq: number;
  type: EstimateChannelActionType;
  payload: unknown;
  senderId: string;
  timestamp: number;
}

export interface EstimatePollingUserInfo {
  tfId: string;
  name: string;
  imageUrl?: string;
}

export interface EstimatePollingSessionDocument {
  id: string;
  activeUsers: Array<{ userInfo: EstimatePollingUserInfo; lastSeen: number }>;
  actions: EstimateChannelAction[];
  nextSeq: number;
  __etag?: number | string;
}

const POLLING_COLLECTION = 'pollingSessions';

function documentUrl(organization: string, documentId: string): string {
  const org = encodeURIComponent(organization.trim());
  const collection = encodeURIComponent(POLLING_COLLECTION);
  const doc = encodeURIComponent(documentId);
  return `https://extmgmt.dev.azure.com/${org}/_apis/ExtensionManagement/InstalledExtensions/${ESTIMATE_PUBLISHER}/${ESTIMATE_EXTENSION}/Data/Scopes/Default/Current/Collections/${collection}/Documents/${doc}?api-version=${ESTIMATE_EXT_DATA_API_VERSION}`;
}

async function extRequest<T>(
  transport: AdoTransport,
  options: {
    method: 'GET' | 'PUT' | 'DELETE';
    documentId: string;
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<T>> {
  const adoUrl = documentUrl(transport.getOrganization(), options.documentId);
  const proxyBase = transport.getExtensionManagementProxyBaseUrl();
  const requestUrl = proxyBase
    ? transport.toExtensionManagementProxyUrl(adoUrl)
    : adoUrl;

  return transport.executeAbsoluteUrl<T>({
    method: options.method,
    adoUrl,
    requestUrl,
    body: options.body,
    signal: options.signal,
    attachPat: !proxyBase,
    retry: options.method === 'GET',
  });
}

export async function getEstimatePollingDocument(
  transport: AdoTransport,
  sessionId: string,
  options?: { signal?: AbortSignal },
): Promise<AdoRequestResult<EstimatePollingSessionDocument>> {
  try {
    return await extRequest<EstimatePollingSessionDocument>(transport, {
      method: 'GET',
      documentId: sessionId,
      signal: options?.signal,
    });
  } catch (error) {
    if (error instanceof AdoClientError && error.statusCode === 404) {
      const empty: EstimatePollingSessionDocument = {
        id: sessionId,
        activeUsers: [],
        actions: [],
        nextSeq: 1,
        __etag: -1,
      };
      return {
        data: empty,
        inspection: {
          id: 'missing',
          method: 'GET',
          url: documentUrl(transport.getOrganization(), sessionId),
          headers: {},
          body: null,
          statusCode: 404,
          statusText: 'Not Found',
          responseBody: null,
          durationMs: null,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          errorMessage: null,
          requestId: null,
        },
      };
    }
    throw error;
  }
}

export async function saveEstimatePollingDocument(
  transport: AdoTransport,
  doc: EstimatePollingSessionDocument,
  options?: { signal?: AbortSignal },
): Promise<AdoRequestResult<EstimatePollingSessionDocument>> {
  return extRequest<EstimatePollingSessionDocument>(transport, {
    method: 'PUT',
    documentId: doc.id,
    body: doc,
    signal: options?.signal,
  });
}

/**
 * Compare-and-swap mutate with a few retries on conflict.
 */
export async function modifyEstimatePollingDocument(
  transport: AdoTransport,
  sessionId: string,
  mutate: (doc: EstimatePollingSessionDocument) => boolean | void,
  options?: { signal?: AbortSignal; maxRetries?: number },
): Promise<EstimatePollingSessionDocument> {
  const maxRetries = options?.maxRetries ?? 4;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const current = await getEstimatePollingDocument(transport, sessionId, {
      signal: options?.signal,
    });
    const doc = { ...current.data, actions: [...(current.data.actions ?? [])] };
    const changed = mutate(doc);
    if (changed === false) return doc;
    try {
      const saved = await saveEstimatePollingDocument(transport, doc, {
        signal: options?.signal,
      });
      return saved.data;
    } catch (error) {
      const status = error instanceof AdoClientError ? error.statusCode : null;
      if (attempt >= maxRetries || (status !== 409 && status !== 400)) {
        throw error;
      }
    }
  }
  throw new Error('Failed to update Estimate live session document.');
}

export async function appendEstimateChannelAction(
  transport: AdoTransport,
  sessionId: string,
  type: EstimateChannelActionType,
  payload: unknown,
  senderId: string,
  options?: { signal?: AbortSignal },
): Promise<EstimatePollingSessionDocument> {
  return modifyEstimatePollingDocument(
    transport,
    sessionId,
    (doc) => {
      const action: EstimateChannelAction = {
        seq: doc.nextSeq || 1,
        type,
        payload,
        senderId,
        timestamp: Date.now(),
      };
      doc.actions = [...(doc.actions ?? []), action];
      doc.nextSeq = (doc.nextSeq || 1) + 1;
      if (doc.actions.length > 100) {
        doc.actions = doc.actions.slice(doc.actions.length - 100);
      }
    },
    options,
  );
}

export async function joinEstimatePollingSession(
  transport: AdoTransport,
  sessionId: string,
  userInfo: EstimatePollingUserInfo,
  options?: { signal?: AbortSignal },
): Promise<EstimatePollingSessionDocument> {
  await modifyEstimatePollingDocument(
    transport,
    sessionId,
    (doc) => {
      doc.activeUsers = (doc.activeUsers ?? []).filter(
        (u) => u.userInfo.tfId !== userInfo.tfId,
      );
      doc.activeUsers.push({ userInfo, lastSeen: Date.now() });
    },
    options,
  );
  return appendEstimateChannelAction(
    transport,
    sessionId,
    'join',
    userInfo,
    userInfo.tfId,
    options,
  );
}

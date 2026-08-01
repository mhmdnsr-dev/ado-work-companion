import { AdoClientError } from '../../types/errors';
import type {
  EstimateHubSessionDocument,
  EstimateHubSessionView,
} from '../../types/estimate-hub';
import {
  ESTIMATE_EXTENSION,
  ESTIMATE_EXT_DATA_API_VERSION,
  ESTIMATE_PUBLISHER,
  EstimateHubSessionSource,
  buildEstimateHubSessionUrl,
} from '../../types/estimate-hub';
import { createId } from '../../utils';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';
import { listTeamIterations, listTeams } from './metadata';
import { getProject } from './projects';
import { getQuery } from './queries';

function buildExtDataCollectionUrl(
  organization: string,
  collectionName: string,
): string {
  const org = encodeURIComponent(organization.trim());
  const collection = encodeURIComponent(collectionName);
  return `https://extmgmt.dev.azure.com/${org}/_apis/ExtensionManagement/InstalledExtensions/${ESTIMATE_PUBLISHER}/${ESTIMATE_EXTENSION}/Data/Scopes/Default/Current/Collections/${collection}/Documents?api-version=${ESTIMATE_EXT_DATA_API_VERSION}`;
}

function buildExtDataDocumentUrl(
  organization: string,
  collectionName: string,
  documentId: string,
): string {
  const org = encodeURIComponent(organization.trim());
  const collection = encodeURIComponent(collectionName);
  const doc = encodeURIComponent(documentId);
  return `https://extmgmt.dev.azure.com/${org}/_apis/ExtensionManagement/InstalledExtensions/${ESTIMATE_PUBLISHER}/${ESTIMATE_EXTENSION}/Data/Scopes/Default/Current/Collections/${collection}/Documents/${doc}?api-version=${ESTIMATE_EXT_DATA_API_VERSION}`;
}

type CollectionFetchResult =
  | { status: 'ok'; documents: EstimateHubSessionDocument[] }
  | { status: 'missing' }
  | { status: 'forbidden'; message: string }
  | { status: 'error'; message: string };

async function fetchDocuments(
  transport: AdoTransport,
  collectionName: string,
  signal?: AbortSignal,
): Promise<CollectionFetchResult> {
  const adoUrl = buildExtDataCollectionUrl(transport.getOrganization(), collectionName);
  const proxyBase = transport.getExtensionManagementProxyBaseUrl();
  const requestUrl = proxyBase
    ? transport.toExtensionManagementProxyUrl(adoUrl)
    : adoUrl;

  try {
    const result = await transport.executeAbsoluteUrl<
      EstimateHubSessionDocument[] | { value?: EstimateHubSessionDocument[] }
    >({
      method: 'GET',
      adoUrl,
      requestUrl,
      signal,
      attachPat: !proxyBase,
      retry: true,
    });

    const data = result.data;
    if (Array.isArray(data)) return { status: 'ok', documents: data };
    if (data && Array.isArray(data.value)) {
      return { status: 'ok', documents: data.value };
    }
    return { status: 'ok', documents: [] };
  } catch (error) {
    if (error instanceof AdoClientError) {
      if (error.statusCode === 404) return { status: 'missing' };
      if (error.statusCode === 403 || error.statusCode === 401) {
        return {
          status: 'forbidden',
          message: error.message || 'Extension Data access denied.',
        };
      }
    }
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to read Estimate Extension Data.',
    };
  }
}

/**
 * Lists Estimate hub sessions for a project (same documents the ADO Estimate hub shows).
 */
export async function listEstimateHubSessions(
  transport: AdoTransport,
  options: {
    project: string;
    signal?: AbortSignal;
  },
): Promise<
  AdoRequestResult<{
    sessions: EstimateHubSessionView[];
    projectId: string;
    accessible: boolean;
    message?: string;
  }>
> {
  const projectName = options.project.trim();
  if (!projectName) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Select a project before listing Estimate hub sessions.',
      retryable: false,
    });
  }

  const projectResult = await getProject(transport, projectName, {
    signal: options.signal,
  });
  const projectId = projectResult.data.id;
  if (!projectId) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Could not resolve project id for Estimate hub sessions.',
      retryable: false,
    });
  }

  const collections = [`sessions-${projectId}`, 'sessions', 'EstimationSessions'];
  const batches = await Promise.all(
    collections.map((name) => fetchDocuments(transport, name, options.signal)),
  );

  const hardError = batches.find((b) => b.status === 'error');
  if (hardError && hardError.status === 'error') {
    throw new AdoClientError({
      kind: 'http',
      message: hardError.message,
      retryable: true,
      statusCode: null,
    });
  }

  const anyOk = batches.some((b) => b.status === 'ok');
  const forbidden = batches.find((b) => b.status === 'forbidden');

  if (!anyOk && forbidden && forbidden.status === 'forbidden') {
    return {
      data: {
        sessions: [],
        projectId,
        accessible: false,
        message:
          forbidden.message ||
          'Extension Data is not readable with this token. Open the Estimate hub in Azure DevOps instead.',
      },
      inspection: projectResult.inspection,
    };
  }

  const byId = new Map<string, EstimateHubSessionDocument & { isLegacy?: boolean }>();
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (!batch || batch.status !== 'ok') continue;
    const isLegacy = collections[i] === 'EstimationSessions';
    for (const doc of batch.documents) {
      if (!doc?.id) continue;
      if (!byId.has(doc.id)) {
        byId.set(doc.id, { ...doc, isLegacy: isLegacy || Boolean(doc.isLegacy) });
      }
    }
  }

  const rawSessions = [...byId.values()];

  const infoBySession = await resolveSessionInfo(transport, {
    project: projectName,
    sessions: rawSessions,
    signal: options.signal,
  });

  const organization = transport.getOrganization();
  const sessions: EstimateHubSessionView[] = rawSessions
    .map((session) => {
      const createdAt =
        session.createdAt == null
          ? undefined
          : typeof session.createdAt === 'string'
            ? session.createdAt
            : new Date(session.createdAt).toISOString();

      return {
        id: session.id,
        name: session.name || session.id,
        source: session.source,
        sourceData: session.sourceData,
        createdAt,
        createdBy: session.createdBy,
        isLegacy: Boolean(session.isLegacy),
        info: infoBySession.get(session.id) ?? [],
        hubUrl: buildEstimateHubSessionUrl(organization, projectName, session.id),
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return {
    data: {
      sessions,
      projectId,
      accessible: true,
      message:
        sessions.length === 0
          ? 'No Estimate hub sessions found for this project.'
          : undefined,
    },
    inspection: projectResult.inspection,
  };
}

/**
 * Probes whether the PAT can write Extension Data for Estimate (Phase 2 gate).
 * Creates then deletes a short-lived probe document in `pollingSessions`.
 */
export async function probeEstimateHubWriteAccess(
  transport: AdoTransport,
  options?: { signal?: AbortSignal },
): Promise<AdoRequestResult<{ writable: boolean; message?: string }>> {
  const probeId = `__ado_work_companion_probe_${Date.now()}`;
  const adoUrl = buildExtDataDocumentUrl(
    transport.getOrganization(),
    'pollingSessions',
    probeId,
  );
  const proxyBase = transport.getExtensionManagementProxyBaseUrl();
  const requestUrl = proxyBase
    ? transport.toExtensionManagementProxyUrl(adoUrl)
    : adoUrl;

  try {
    const putResult = await transport.executeAbsoluteUrl({
      method: 'PUT',
      adoUrl,
      requestUrl,
      body: {
        id: probeId,
        activeUsers: [],
        actions: [],
        nextSeq: 1,
        __etag: -1,
      },
      signal: options?.signal,
      attachPat: !proxyBase,
      retry: false,
    });

    try {
      await transport.executeAbsoluteUrl({
        method: 'DELETE',
        adoUrl,
        requestUrl,
        signal: options?.signal,
        attachPat: !proxyBase,
        retry: false,
      });
    } catch {
      // best-effort cleanup
    }

    return {
      data: { writable: true },
      inspection: putResult.inspection,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Cannot write Estimate extension data with this token.';
    return {
      data: { writable: false, message },
      inspection: {
        id: createId('probe'),
        method: 'PUT',
        url: adoUrl,
        headers: {},
        body: null,
        statusCode: error instanceof AdoClientError ? error.statusCode : null,
        statusText: null,
        responseBody: null,
        durationMs: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        errorMessage: message,
        requestId: null,
      },
    };
  }
}

async function resolveSessionInfo(
  transport: AdoTransport,
  options: {
    project: string;
    sessions: EstimateHubSessionDocument[];
    signal?: AbortSignal;
  },
): Promise<Map<string, { label: string; value: string }[]>> {
  const result = new Map<string, { label: string; value: string }[]>();

  let teamsById = new Map<string, string>();
  try {
    const teams = await listTeams(transport, {
      project: options.project,
      signal: options.signal,
    });
    teamsById = new Map(
      (teams.data ?? []).map((team) => [team.id, team.name] as const),
    );
  } catch {
    teamsById = new Map();
  }

  const sprintPairs = options.sessions
    .filter((s) => s.source === EstimateHubSessionSource.Sprint && typeof s.sourceData === 'string')
    .map((s) => {
      const [teamId = '', iterationId = ''] = String(s.sourceData).split(';');
      return { sessionId: s.id, teamId, iterationId };
    })
    .filter((p): p is { sessionId: string; teamId: string; iterationId: string } =>
      Boolean(p.teamId && p.iterationId),
    );

  const iterationNameByKey = new Map<string, string>();
  const teamIds = [...new Set(sprintPairs.map((p) => p.teamId))];
  await Promise.all(
    teamIds.map(async (teamId) => {
      try {
        const teamName = teamsById.get(teamId) ?? teamId;
        const iterations = await listTeamIterations(transport, {
          project: options.project,
          team: teamName,
          signal: options.signal,
        });
        for (const iteration of iterations.data ?? []) {
          if (iteration.id) {
            iterationNameByKey.set(`${teamId};${iteration.id}`, iteration.name);
          }
        }
      } catch {
        // ignore
      }
    }),
  );

  const queryIds = [
    ...new Set(
      options.sessions
        .filter(
          (s) =>
            s.source === EstimateHubSessionSource.Query && typeof s.sourceData === 'string',
        )
        .map((s) => String(s.sourceData)),
    ),
  ];

  const queryNameById = new Map<string, string>();
  await Promise.all(
    queryIds.map(async (queryId) => {
      try {
        const query = await getQuery(transport, {
          idOrPath: queryId,
          project: options.project,
          signal: options.signal,
        });
        if (query.data?.name) queryNameById.set(queryId, query.data.name);
      } catch {
        // ignore
      }
    }),
  );

  for (const session of options.sessions) {
    const info: { label: string; value: string }[] = [];
    if (session.source === EstimateHubSessionSource.Sprint && typeof session.sourceData === 'string') {
      const [teamId = '', iterationId = ''] = session.sourceData.split(';');
      info.push({
        label: 'Team',
        value: (teamId && teamsById.get(teamId)) || teamId || '—',
      });
      info.push({
        label: 'Sprint',
        value:
          (teamId &&
            iterationId &&
            iterationNameByKey.get(`${teamId};${iterationId}`)) ||
          iterationId ||
          '—',
      });
    } else if (
      session.source === EstimateHubSessionSource.Query &&
      typeof session.sourceData === 'string'
    ) {
      info.push({
        label: 'Query',
        value: queryNameById.get(session.sourceData) || session.sourceData,
      });
    } else if (session.source === EstimateHubSessionSource.Ids) {
      const ids = Array.isArray(session.sourceData) ? session.sourceData : [];
      info.push({
        label: 'Work items',
        value: ids.length ? `${ids.length} selected` : 'Ids',
      });
    }
    if (session.isLegacy) {
      info.push({ label: 'Type', value: 'Legacy' });
    }
    result.set(session.id, info);
  }

  return result;
}

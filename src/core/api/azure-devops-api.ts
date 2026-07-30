import {
  ADO_API,
  ADO_JSON_CONTENT_TYPE,
  ADO_JSON_PATCH_CONTENT_TYPE,
  ADO_MAX_SIMPLE_ATTACHMENT_BYTES,
  ADO_OCTET_STREAM_CONTENT_TYPE,
} from '../constants/api';
import type { AdoHttpMethod } from '../constants/api';
import { AdoClientError } from '../types/errors';
import type { AdoErrorPayload } from '../types/errors';
import type { HttpClient, HttpHeaders, RequestInspectionRecord } from '../types/http';
import type {
  AdoListResponse,
  AuthenticatedUser,
  ConnectionData,
  TeamProject,
  TeamProjectReference,
} from '../types/projects';
import type {
  TeamMember,
  TeamSetting,
  TeamSettingsIteration,
  WebApiTeam,
  WorkItemClassificationNode,
  WorkItemComment,
  WorkItemCommentList,
  WorkItemField,
  WorkItemRelationType,
  IterationWorkItems,
  WorkItemStateColor,
  WorkItemType,
} from '../types/metadata';
import type { QueryExpand, QueryHierarchyItem } from '../types/queries';
import type {
  JsonPatchOperation,
  WorkItem,
  WorkItemExpand,
  WorkItemQueryResult,
} from '../types/work-items';
import { WORK_ITEM_LIST_FIELDS } from '../types/work-items';
import {
  buildAdoResourceUrl,
  buildAnalyticsODataUrl,
  buildPatAuthorizationHeader,
  createId,
  isAbortError,
  redactAuthorizationHeaders,
  sleep,
} from '../utils';

export interface AzureDevOpsApiOptions {
  http: HttpClient;
  organization: string;
  project?: string;
  apiVersion?: string;
  /**
   * Only required for direct (non-proxy) calls.
   * When `proxyBaseUrl` is set, the Next.js proxy injects the PAT from the
   * HttpOnly server session — do not send Authorization from the browser.
   */
  pat?: string;
  /**
   * When set, requests go to this origin instead of dev.azure.com
   * (e.g. `/api/ado` Next.js proxy). The proxy reconstructs the ADO URL.
   */
  proxyBaseUrl?: string;
  /**
   * When set, Analytics OData requests go here instead of analytics.dev.azure.com
   * (e.g. `/api/analytics`).
   */
  analyticsProxyBaseUrl?: string;
  onRequestComplete?: (record: RequestInspectionRecord) => void;
}

export interface AdoRequestOptions {
  method?: AdoHttpMethod;
  path: string;
  /** Override configured project for this call; `null` forces org scope. */
  project?: string | null;
  /** Team segment for Work APIs (`/{project}/{team}/_apis/...`). */
  team?: string | null;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Binary body for attachment uploads (takes precedence over `body`). */
  rawBody?: ArrayBuffer | Blob;
  /** Content-Type for `rawBody` (defaults to application/octet-stream). */
  rawContentType?: string;
  /** Use JSON Patch content type (work item updates). */
  jsonPatch?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Idempotent GETs retry on transient failures by default. */
  retry?: boolean;
  /** Use arrayBuffer response parsing (attachment downloads). */
  responseType?: 'text' | 'arrayBuffer';
}

export interface AdoRequestResult<T> {
  data: T;
  inspection: RequestInspectionRecord;
}

/** Encode a query id or path for `/_apis/wit/queries/{query}` (preserve `/`). */
function encodeQueryResourcePath(idOrPath: string): string {
  return idOrPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function parseAdoErrorBody(bodyText: string): AdoErrorPayload | null {
  if (!bodyText) return null;
  try {
    const parsed = JSON.parse(bodyText) as {
      message?: string;
      typeKey?: string;
      errorCode?: number;
      eventId?: number;
      code?: number;
      innerException?: unknown;
    };
    return {
      message: parsed.message,
      typeKey: parsed.typeKey,
      errorCode: parsed.errorCode ?? parsed.code,
      eventId: parsed.eventId,
      innerException: parsed.innerException,
    };
  } catch {
    return { message: bodyText.slice(0, 500) };
  }
}

/**
 * Some ADO endpoints (notably work item delete) return HTTP 2xx with a failure
 * envelope: `{ id, code: 404, message: "VS403145: ..." }`.
 */
function adoFailureFromSuccessBody(data: unknown): {
  code: number;
  message: string;
} | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const code = record.code;
  if (typeof code !== 'number' || !Number.isFinite(code) || code < 400) {
    return null;
  }
  const message =
    typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : `Azure DevOps request failed with code ${code}`;
  return { code, message };
}

function suggestionsForStatus(status: number): string[] {
  switch (status) {
    case 401:
      return [
        'Verify the Personal Access Token is valid and not expired.',
        'Ensure the PAT has the required scopes (e.g. Project & Team read, Analytics read).',
      ];
    case 403:
      return [
        'Your account may lack permission for this resource.',
        'Analytics OData requires Basic access (Stakeholder is not enough).',
        'Confirm you are a project member with access to the organization and project.',
      ];
    case 404:
      return [
        'Check the organization name spelling.',
        'If using a project, confirm it exists and you can access it.',
      ];
    case 429:
      return ['Azure DevOps rate-limited the request. Wait briefly and retry.'];
    default:
      if (status >= 500) {
        return ['Azure DevOps may be temporarily unavailable. Retry shortly.'];
      }
      return ['Review the request URL, API version, and payload.'];
  }
}

/**
 * Single gateway for all Azure DevOps REST traffic.
 * Expand resource helpers in later steps; never call fetch from features.
 */
export class AzureDevOpsApi {
  private readonly http: HttpClient;
  private organization: string;
  private project: string | undefined;
  private apiVersion: string;
  private pat: string;
  private readonly proxyBaseUrl: string | undefined;
  private readonly analyticsProxyBaseUrl: string | undefined;
  private readonly onRequestComplete?: (record: RequestInspectionRecord) => void;

  constructor(options: AzureDevOpsApiOptions) {
    this.http = options.http;
    this.organization = options.organization.trim();
    this.project = options.project?.trim() || undefined;
    this.apiVersion = options.apiVersion?.trim() || ADO_API.DEFAULT_VERSION;
    this.pat = options.pat ?? '';
    this.proxyBaseUrl = options.proxyBaseUrl?.replace(/\/+$/, '');
    this.analyticsProxyBaseUrl = options.analyticsProxyBaseUrl?.replace(/\/+$/, '');
    this.onRequestComplete = options.onRequestComplete;

    if (!this.proxyBaseUrl && !this.pat) {
      throw new Error(
        'AzureDevOpsApi requires either proxyBaseUrl (session auth) or a PAT.',
      );
    }
  }

  updateConfig(partial: {
    organization?: string;
    project?: string | null;
    apiVersion?: string;
    pat?: string;
  }): void {
    if (partial.organization !== undefined) {
      this.organization = partial.organization.trim();
    }
    if (partial.project !== undefined) {
      this.project = partial.project?.trim() || undefined;
    }
    if (partial.apiVersion !== undefined) {
      this.apiVersion = partial.apiVersion.trim() || ADO_API.DEFAULT_VERSION;
    }
    if (partial.pat !== undefined) {
      this.pat = partial.pat;
    }
  }

  getConfig(): {
    organization: string;
    project: string | undefined;
    apiVersion: string;
  } {
    return {
      organization: this.organization,
      project: this.project,
      apiVersion: this.apiVersion,
    };
  }

  /**
   * Lists projects the authenticated user can access.
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.2
   */
  async listProjects(options?: {
    signal?: AbortSignal;
    stateFilter?: string;
    top?: number;
    skip?: number;
    getDefaultTeamImageUrl?: boolean;
  }): Promise<AdoRequestResult<TeamProjectReference[]>> {
    const result = await this.request<AdoListResponse<TeamProjectReference>>({
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
  async getAuthenticatedUser(options?: {
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<AuthenticatedUser | null>> {
    const result = await this.request<ConnectionData>({
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
  async getProject(
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

    return this.request<TeamProject>({
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
  async testConnection(options?: { signal?: AbortSignal }): Promise<
    AdoRequestResult<{
      projectCount: number;
      organization: string;
      projects: TeamProjectReference[];
    }>
  > {
    const listed = await this.listProjects({ signal: options?.signal });
    return {
      data: {
        projectCount: listed.data.length,
        organization: this.organization,
        projects: listed.data,
      },
      inspection: listed.inspection,
    };
  }

  /**
   * Executes a WIQL query and returns matching work item references.
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.2
   */
  async queryByWiql(options: {
    query: string;
    top?: number;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemQueryResult>> {
    return this.request<WorkItemQueryResult>({
      method: 'POST',
      path: '_apis/wit/wiql',
      project: options.project === undefined ? this.project : options.project,
      query: {
        $top: options.top ?? 200,
      },
      body: { query: options.query },
      signal: options.signal,
      retry: false,
    });
  }

  /**
   * Lists the root query folders (My Queries / Shared Queries) and descendants.
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/queries/list?view=azure-devops-rest-7.2
   */
  async listQueries(options?: {
    depth?: number;
    expand?: QueryExpand;
    includeDeleted?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<QueryHierarchyItem[]>> {
    const result = await this.request<AdoListResponse<QueryHierarchyItem>>({
      method: 'GET',
      path: '_apis/wit/queries',
      project: options?.project === undefined ? this.project : options.project,
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
  async getQuery(options: {
    idOrPath: string;
    depth?: number;
    expand?: QueryExpand;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<QueryHierarchyItem>> {
    const idOrPath = options.idOrPath.trim();
    if (!idOrPath) {
      throw new AdoClientError({
        kind: 'validation',
        message: 'Query id or path is required.',
        retryable: false,
      });
    }

    return this.request<QueryHierarchyItem>({
      method: 'GET',
      path: `_apis/wit/queries/${encodeQueryResourcePath(idOrPath)}`,
      project: options.project === undefined ? this.project : options.project,
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
  async queryById(options: {
    id: string;
    top?: number;
    timePrecision?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemQueryResult>> {
    const id = options.id.trim();
    if (!id) {
      throw new AdoClientError({
        kind: 'validation',
        message: 'Query id is required.',
        retryable: false,
      });
    }

    return this.request<WorkItemQueryResult>({
      method: 'GET',
      path: `_apis/wit/wiql/${encodeURIComponent(id)}`,
      project: options.project === undefined ? this.project : options.project,
      query: {
        $top: options.top ?? 200,
        timePrecision: options.timePrecision,
      },
      signal: options.signal,
      retry: true,
    });
  }

  /**
   * Gets one or more work items by id.
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/list?view=azure-devops-rest-7.2
   */
  async getWorkItems(options: {
    ids: number[];
    fields?: readonly string[];
    expand?: WorkItemExpand;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem[]>> {
    const ids = [...new Set(options.ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) {
      throw new AdoClientError({
        kind: 'validation',
        message: 'At least one work item id is required.',
        retryable: false,
      });
    }

    const result = await this.request<AdoListResponse<WorkItem>>({
      method: 'GET',
      path: '_apis/wit/workitems',
      project: options.project === undefined ? this.project : options.project,
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
  async getWorkItem(options: {
    id: number;
    fields?: readonly string[];
    expand?: WorkItemExpand;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem>> {
    return this.request<WorkItem>({
      method: 'GET',
      path: `_apis/wit/workitems/${options.id}`,
      project: options.project === undefined ? this.project : options.project,
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
  async createWorkItem(options: {
    type: string;
    operations: JsonPatchOperation[];
    project: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem>> {
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

    return this.request<WorkItem>({
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
  async updateWorkItem(options: {
    id: number;
    operations: JsonPatchOperation[];
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem>> {
    return this.request<WorkItem>({
      method: 'PATCH',
      path: `_apis/wit/workitems/${options.id}`,
      project: options.project === undefined ? this.project : options.project,
      body: options.operations,
      jsonPatch: true,
      signal: options.signal,
      retry: false,
    });
  }

  /**
   * Uploads an attachment (simple / non-chunked).
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/attachments/create?view=azure-devops-rest-7.2
   */
  async uploadAttachment(options: {
    fileName: string;
    content: ArrayBuffer | Blob;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<{ id: string; url: string }>> {
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

    return this.request<{ id: string; url: string }>({
      method: 'POST',
      path: '_apis/wit/attachments',
      project: options.project === undefined ? this.project : options.project,
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
  async downloadAttachment(options: {
    id: string;
    fileName?: string;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<
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

    const result = await this.request<{
      buffer: ArrayBuffer;
      contentType?: string;
      contentDisposition?: string;
    }>({
      method: 'GET',
      path: `_apis/wit/attachments/${encodeURIComponent(id)}`,
      project: options.project === undefined ? this.project : options.project,
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
  async attachFileToWorkItem(options: {
    workItemId: number;
    fileName: string;
    content: ArrayBuffer | Blob;
    comment?: string;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem>> {
    const uploaded = await this.uploadAttachment({
      fileName: options.fileName,
      content: options.content,
      project: options.project,
      signal: options.signal,
    });

    const attachmentUrl = uploaded.data.url?.includes('fileName=')
      ? uploaded.data.url
      : `${uploaded.data.url}${uploaded.data.url.includes('?') ? '&' : '?'}fileName=${encodeURIComponent(options.fileName)}`;

    const comment = options.comment?.trim();
    return this.updateWorkItem({
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
  async detachWorkItemAttachment(options: {
    workItemId: number;
    relationIndex: number;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem>> {
    if (!Number.isInteger(options.relationIndex) || options.relationIndex < 0) {
      throw new AdoClientError({
        kind: 'validation',
        message: 'A valid attachment relation index is required.',
        retryable: false,
      });
    }

    return this.updateWorkItem({
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

  /**
   * Deletes a work item (recycle bin unless destroy=true).
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/delete?view=azure-devops-rest-7.2
   */
  async deleteWorkItem(options: {
    id: number;
    destroy?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<unknown>> {
    return this.request<unknown>({
      method: 'DELETE',
      path: `_apis/wit/workitems/${options.id}`,
      project: options.project === undefined ? this.project : options.project,
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
  async listWorkItemRevisions(options: {
    id: number;
    top?: number;
    skip?: number;
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItem[]>> {
    const result = await this.request<AdoListResponse<WorkItem>>({
      method: 'GET',
      path: `_apis/wit/workitems/${options.id}/revisions`,
      project: options.project === undefined ? this.project : options.project,
      query: {
        $top: options.top ?? 50,
        $skip: options.skip,
      },
      signal: options.signal,
      retry: true,
    });

    return { data: result.data.value ?? [], inspection: result.inspection };
  }

  /**
   * Lists teams in a project.
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-teams?view=azure-devops-rest-7.2
   */
  async listTeams(options: {
    project: string;
    top?: number;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WebApiTeam[]>> {
    const project = options.project.trim();
    const result = await this.request<AdoListResponse<WebApiTeam>>({
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
  async listTeamMembers(options: {
    project: string;
    team: string;
    top?: number;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<TeamMember[]>> {
    const project = options.project.trim();
    const team = options.team.trim();
    const result = await this.request<AdoListResponse<TeamMember>>({
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
  async getTeamSettings(options: {
    project: string;
    team: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<TeamSetting>> {
    return this.request<TeamSetting>({
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
  async listTeamIterations(options: {
    project: string;
    team: string;
    timeframe?: 'current' | 'past' | 'future';
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<TeamSettingsIteration[]>> {
    const result = await this.request<AdoListResponse<TeamSettingsIteration>>({
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
  async getIterationWorkItems(options: {
    project: string;
    team: string;
    iterationId: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<IterationWorkItems>> {
    return this.request<IterationWorkItems>({
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
  async getClassificationNode(options: {
    project: string;
    structureGroup: 'areas' | 'iterations';
    depth?: number;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemClassificationNode>> {
    return this.request<WorkItemClassificationNode>({
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
  async listWorkItemTypeStates(options: {
    project: string;
    type: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemStateColor[]>> {
    const type = options.type.trim();
    const result = await this.request<AdoListResponse<WorkItemStateColor>>({
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
  async listWorkItemTypes(options: {
    project: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemType[]>> {
    const result = await this.request<AdoListResponse<WorkItemType>>({
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
  async listWorkItemFields(options?: {
    project?: string | null;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemField[]>> {
    const result = await this.request<AdoListResponse<WorkItemField>>({
      method: 'GET',
      path: '_apis/wit/fields',
      project: options?.project === undefined ? this.project : options.project,
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
  async listWorkItemRelationTypes(options?: {
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemRelationType[]>> {
    const result = await this.request<AdoListResponse<WorkItemRelationType>>({
      method: 'GET',
      path: '_apis/wit/workitemrelationtypes',
      project: null,
      signal: options?.signal,
      retry: true,
    });
    return { data: result.data.value ?? [], inspection: result.inspection };
  }

  /**
   * Lists comments on a work item.
   * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/get-comments?view=azure-devops-rest-7.2
   */
  async listWorkItemComments(options: {
    id: number;
    project: string;
    top?: number;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemComment[]>> {
    const result = await this.request<WorkItemCommentList>({
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
  async addWorkItemComment(options: {
    id: number;
    project: string;
    text: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<WorkItemComment>> {
    return this.request<WorkItemComment>({
      method: 'POST',
      path: `_apis/wit/workItems/${options.id}/comments`,
      project: options.project,
      body: { text: options.text },
      signal: options.signal,
      retry: false,
    });
  }

  /**
   * Queries Azure DevOps Analytics OData.
   * Requires PAT scope Analytics (read).
   * @see https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/odata-query-guidelines
   */
  async queryAnalytics<T>(options: {
    project: string;
    entity: string;
    apply: string;
    orderby?: string;
    odataVersion?: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<T>> {
    const project = options.project.trim();
    if (!project) {
      throw new AdoClientError({
        kind: 'validation',
        message: 'Select a project before querying Analytics.',
        retryable: false,
      });
    }

    const analyticsUrl = buildAnalyticsODataUrl({
      organization: this.organization,
      project,
      entity: options.entity,
      apply: options.apply,
      orderby: options.orderby,
      odataVersion: options.odataVersion,
    });

    const requestUrl = this.analyticsProxyBaseUrl
      ? this.toAnalyticsProxyUrl(analyticsUrl)
      : analyticsUrl;

    return this.executeAbsoluteUrl<T>({
      method: 'GET',
      adoUrl: analyticsUrl,
      requestUrl,
      signal: options.signal,
      attachPat: !this.analyticsProxyBaseUrl,
      retry: true,
    });
  }

  async request<T>(options: AdoRequestOptions): Promise<AdoRequestResult<T>> {
    const method = options.method ?? 'GET';
    const shouldRetry = options.retry ?? (method === 'GET' || method === 'DELETE');
    const maxAttempts = shouldRetry ? ADO_API.MAX_RETRIES + 1 : 1;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.executeOnce<T>(options, method);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof AdoClientError &&
          error.retryable &&
          attempt < maxAttempts - 1 &&
          !options.signal?.aborted;

        if (!retryable) throw error;

        await sleep(ADO_API.RETRY_BASE_DELAY_MS * 2 ** attempt, options.signal);
      }
    }

    throw lastError;
  }

  private async executeOnce<T>(
    options: AdoRequestOptions,
    method: AdoHttpMethod,
  ): Promise<AdoRequestResult<T>> {
    const projectScope =
      options.project === null ? undefined : (options.project ?? this.project);
    const teamScope = options.team?.trim() || undefined;

    const adoUrl = buildAdoResourceUrl({
      organization: this.organization,
      project: projectScope,
      team: teamScope,
      path: options.path,
      apiVersion: this.apiVersion,
      query: options.query,
    });

    const requestUrl = this.proxyBaseUrl ? this.toProxyUrl(adoUrl) : adoUrl;

    return this.executeAbsoluteUrlOnce<T>({
      method,
      adoUrl,
      requestUrl,
      body: options.body,
      rawBody: options.rawBody,
      rawContentType: options.rawContentType,
      jsonPatch: options.jsonPatch,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      attachPat: !this.proxyBaseUrl,
      responseType: options.responseType,
    });
  }

  private async executeAbsoluteUrl<T>(options: {
    method: AdoHttpMethod;
    adoUrl: string;
    requestUrl: string;
    body?: unknown;
    rawBody?: ArrayBuffer | Blob;
    rawContentType?: string;
    jsonPatch?: boolean;
    signal?: AbortSignal;
    timeoutMs?: number;
    attachPat: boolean;
    retry?: boolean;
    responseType?: 'text' | 'arrayBuffer';
  }): Promise<AdoRequestResult<T>> {
    const shouldRetry = options.retry ?? false;
    const maxAttempts = shouldRetry ? ADO_API.MAX_RETRIES + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.executeAbsoluteUrlOnce<T>(options);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof AdoClientError &&
          error.retryable &&
          attempt < maxAttempts - 1 &&
          !options.signal?.aborted;
        if (!retryable) throw error;
        await sleep(ADO_API.RETRY_BASE_DELAY_MS * 2 ** attempt, options.signal);
      }
    }

    throw lastError;
  }

  private async executeAbsoluteUrlOnce<T>(options: {
    method: AdoHttpMethod;
    adoUrl: string;
    requestUrl: string;
    body?: unknown;
    rawBody?: ArrayBuffer | Blob;
    rawContentType?: string;
    jsonPatch?: boolean;
    signal?: AbortSignal;
    timeoutMs?: number;
    attachPat: boolean;
    responseType?: 'text' | 'arrayBuffer';
  }): Promise<AdoRequestResult<T>> {
    const method = options.method;
    const headers: Record<string, string> = {
      Accept: options.responseType === 'arrayBuffer' ? '*/*' : ADO_JSON_CONTENT_TYPE,
      'X-TFS-FedAuthRedirect': 'Suppress',
    };

    if (options.attachPat) {
      headers.Authorization = buildPatAuthorizationHeader(this.pat);
    }

    let requestBody: string | ArrayBuffer | Blob | null = null;
    let inspectionBody: string | null = null;

    if (options.rawBody !== undefined && options.rawBody !== null) {
      requestBody = options.rawBody;
      headers['Content-Type'] = options.rawContentType ?? ADO_OCTET_STREAM_CONTENT_TYPE;
      const size =
        options.rawBody instanceof Blob
          ? options.rawBody.size
          : options.rawBody.byteLength;
      inspectionBody = `[binary ${size} bytes]`;
    } else if (options.body !== undefined && options.body !== null) {
      requestBody =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      inspectionBody = typeof requestBody === 'string' ? requestBody : null;
      headers['Content-Type'] = options.jsonPatch
        ? ADO_JSON_PATCH_CONTENT_TYPE
        : ADO_JSON_CONTENT_TYPE;
    }

    const inspectionId = createId('req');
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const inspection: RequestInspectionRecord = {
      id: inspectionId,
      method,
      url: options.adoUrl,
      headers: redactAuthorizationHeaders(headers),
      body: inspectionBody,
      statusCode: null,
      statusText: null,
      responseBody: null,
      durationMs: null,
      startedAt,
      finishedAt: null,
      errorMessage: null,
      requestId: null,
    };

    try {
      const response = await this.http.request({
        method,
        url: options.requestUrl,
        headers,
        body: requestBody,
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? ADO_API.DEFAULT_TIMEOUT_MS,
        responseType: options.responseType,
      });

      inspection.statusCode = response.status;
      inspection.statusText = response.statusText;
      inspection.responseBody =
        options.responseType === 'arrayBuffer'
          ? `[binary ${response.bodyArrayBuffer?.byteLength ?? 0} bytes]`
          : response.bodyText;
      inspection.requestId =
        response.headers['x-vms-activityid'] ??
        response.headers['x-vss-e2eid'] ??
        response.headers['request-id'] ??
        null;
      inspection.finishedAt = new Date().toISOString();
      inspection.durationMs = Date.now() - startedMs;
      this.onRequestComplete?.(inspection);

      if (response.status < 200 || response.status >= 300) {
        const ado = parseAdoErrorBody(response.bodyText);
        throw new AdoClientError({
          message:
            ado?.message ?? `Azure DevOps request failed with HTTP ${response.status}`,
          kind: 'http',
          statusCode: response.status,
          requestId: inspection.requestId,
          ado,
          suggestions: suggestionsForStatus(response.status),
          retryable: response.status === 429 || response.status >= 500,
        });
      }

      if (options.responseType === 'arrayBuffer') {
        if (!response.bodyArrayBuffer) {
          throw new AdoClientError({
            message: 'Empty binary response from Azure DevOps.',
            kind: 'parse',
            statusCode: response.status,
            requestId: inspection.requestId,
          });
        }
        return {
          data: {
            buffer: response.bodyArrayBuffer,
            contentType: response.headers['content-type'],
            contentDisposition: response.headers['content-disposition'],
          } as T,
          inspection,
        };
      }

      if (!response.bodyText) {
        return { data: undefined as T, inspection };
      }

      try {
        const data = JSON.parse(response.bodyText) as T;
        const embeddedFailure = adoFailureFromSuccessBody(data);
        if (embeddedFailure) {
          throw new AdoClientError({
            message: embeddedFailure.message,
            kind: 'http',
            statusCode: embeddedFailure.code,
            requestId: inspection.requestId,
            ado: {
              message: embeddedFailure.message,
              errorCode: embeddedFailure.code,
            },
            suggestions: suggestionsForStatus(embeddedFailure.code),
            retryable: false,
          });
        }
        return { data, inspection };
      } catch (cause) {
        if (cause instanceof AdoClientError) throw cause;
        throw new AdoClientError({
          message: 'Failed to parse Azure DevOps JSON response',
          kind: 'parse',
          statusCode: response.status,
          requestId: inspection.requestId,
          cause,
        });
      }
    } catch (error) {
      if (error instanceof AdoClientError) {
        inspection.errorMessage = error.message;
        inspection.finishedAt = new Date().toISOString();
        inspection.durationMs = Date.now() - startedMs;
        this.onRequestComplete?.(inspection);
        throw error;
      }

      if (isAbortError(error)) {
        const clientError = new AdoClientError({
          message: 'Request was cancelled',
          kind: 'abort',
          cause: error,
        });
        inspection.errorMessage = clientError.message;
        inspection.finishedAt = new Date().toISOString();
        inspection.durationMs = Date.now() - startedMs;
        this.onRequestComplete?.(inspection);
        throw clientError;
      }

      const clientError = new AdoClientError({
        message: error instanceof Error ? error.message : 'Unexpected request failure',
        kind: 'unknown',
        retryable: true,
        cause: error,
      });
      inspection.errorMessage = clientError.message;
      inspection.finishedAt = new Date().toISOString();
      inspection.durationMs = Date.now() - startedMs;
      this.onRequestComplete?.(inspection);
      throw clientError;
    }
  }

  private toProxyUrl(adoUrl: string): string {
    const parsed = new URL(adoUrl);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    return `${this.proxyBaseUrl}${pathAndQuery}`;
  }

  private toAnalyticsProxyUrl(analyticsUrl: string): string {
    if (!this.analyticsProxyBaseUrl) {
      throw new Error('analyticsProxyBaseUrl is not configured.');
    }
    const parsed = new URL(analyticsUrl);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    return `${this.analyticsProxyBaseUrl}${pathAndQuery}`;
  }
}

export type { HttpHeaders };

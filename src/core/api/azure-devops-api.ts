import {
  ADO_API,
  ADO_JSON_CONTENT_TYPE,
  ADO_JSON_PATCH_CONTENT_TYPE,
} from '../constants/api';
import type { AdoHttpMethod } from '../constants/api';
import { AdoClientError } from '../types/errors';
import type { AdoErrorPayload } from '../types/errors';
import type { HttpClient, HttpHeaders, RequestInspectionRecord } from '../types/http';
import type { AdoListResponse, TeamProjectReference } from '../types/projects';
import {
  buildAdoResourceUrl,
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
  pat: string;
  /**
   * When set, requests go to this origin instead of dev.azure.com
   * (e.g. `/api/ado` Next.js proxy). The proxy reconstructs the ADO URL.
   */
  proxyBaseUrl?: string;
  onRequestComplete?: (record: RequestInspectionRecord) => void;
}

export interface AdoRequestOptions {
  method?: AdoHttpMethod;
  path: string;
  /** Override configured project for this call; `null` forces org scope. */
  project?: string | null;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Use JSON Patch content type (work item updates). */
  jsonPatch?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Idempotent GETs retry on transient failures by default. */
  retry?: boolean;
}

export interface AdoRequestResult<T> {
  data: T;
  inspection: RequestInspectionRecord;
}

function parseAdoErrorBody(bodyText: string): AdoErrorPayload | null {
  if (!bodyText) return null;
  try {
    const parsed = JSON.parse(bodyText) as {
      message?: string;
      typeKey?: string;
      errorCode?: number;
      eventId?: number;
      innerException?: unknown;
    };
    return {
      message: parsed.message,
      typeKey: parsed.typeKey,
      errorCode: parsed.errorCode,
      eventId: parsed.eventId,
      innerException: parsed.innerException,
    };
  } catch {
    return { message: bodyText.slice(0, 500) };
  }
}

function suggestionsForStatus(status: number): string[] {
  switch (status) {
    case 401:
      return [
        'Verify the Personal Access Token is valid and not expired.',
        'Ensure the PAT has the required scopes (e.g. Project & Team read).',
      ];
    case 403:
      return [
        'Your PAT may lack the required scopes for this resource.',
        'Confirm you have access to the organization and project.',
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
  private readonly onRequestComplete?: (record: RequestInspectionRecord) => void;

  constructor(options: AzureDevOpsApiOptions) {
    this.http = options.http;
    this.organization = options.organization.trim();
    this.project = options.project?.trim() || undefined;
    this.apiVersion = options.apiVersion?.trim() || ADO_API.DEFAULT_VERSION;
    this.pat = options.pat;
    this.proxyBaseUrl = options.proxyBaseUrl?.replace(/\/+$/, '');
    this.onRequestComplete = options.onRequestComplete;
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
  }): Promise<AdoRequestResult<TeamProjectReference[]>> {
    const result = await this.request<AdoListResponse<TeamProjectReference>>({
      method: 'GET',
      path: '_apis/projects',
      project: null,
      query: {
        stateFilter: options?.stateFilter ?? 'wellFormed',
        $top: 1000,
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

    const adoUrl = buildAdoResourceUrl({
      organization: this.organization,
      project: projectScope,
      path: options.path,
      apiVersion: this.apiVersion,
      query: options.query,
    });

    const url = this.proxyBaseUrl ? this.toProxyUrl(adoUrl) : adoUrl;

    const headers: Record<string, string> = {
      Accept: ADO_JSON_CONTENT_TYPE,
      Authorization: buildPatAuthorizationHeader(this.pat),
      'X-TFS-FedAuthRedirect': 'Suppress',
    };

    let bodyText: string | null = null;
    if (options.body !== undefined && options.body !== null) {
      bodyText =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
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
      url: adoUrl,
      headers: redactAuthorizationHeaders(headers),
      body: bodyText,
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
        url,
        headers,
        body: bodyText,
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? ADO_API.DEFAULT_TIMEOUT_MS,
      });

      inspection.statusCode = response.status;
      inspection.statusText = response.statusText;
      inspection.responseBody = response.bodyText;
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

      if (!response.bodyText) {
        return { data: undefined as T, inspection };
      }

      try {
        const data = JSON.parse(response.bodyText) as T;
        return { data, inspection };
      } catch (cause) {
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
}

export type { HttpHeaders };

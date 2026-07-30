import {
  ADO_API,
  ADO_JSON_CONTENT_TYPE,
  ADO_JSON_PATCH_CONTENT_TYPE,
  ADO_OCTET_STREAM_CONTENT_TYPE,
} from '../constants/api';
import type { AdoHttpMethod } from '../constants/api';
import { AdoClientError } from '../types/errors';
import type { HttpClient, RequestInspectionRecord } from '../types/http';
import {
  buildAdoResourceUrl,
  buildPatAuthorizationHeader,
  createId,
  isAbortError,
  redactAuthorizationHeaders,
  sleep,
} from '../utils';
import {
  adoFailureFromSuccessBody,
  parseAdoErrorBody,
  suggestionsForStatus,
} from './request-helpers';
import type {
  AdoAbsoluteRequestOptions,
  AdoRequestOptions,
  AdoRequestResult,
  AzureDevOpsApiOptions,
} from './types';

/**
 * Low-level ADO HTTP transport (config + request pipeline).
 * Resource modules call `request` / `executeAbsoluteUrl`; features never use this directly.
 */
export class AdoTransport {
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

  getOrganization(): string {
    return this.organization;
  }

  getProject(): string | undefined {
    return this.project;
  }

  getAnalyticsProxyBaseUrl(): string | undefined {
    return this.analyticsProxyBaseUrl;
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
    project?: string;
    apiVersion: string;
    hasPat: boolean;
    usingProxy: boolean;
  } {
    return {
      organization: this.organization,
      project: this.project,
      apiVersion: this.apiVersion,
      hasPat: Boolean(this.pat),
      usingProxy: Boolean(this.proxyBaseUrl),
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

  async executeAbsoluteUrl<T>(
    options: AdoAbsoluteRequestOptions,
  ): Promise<AdoRequestResult<T>> {
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

  toAnalyticsProxyUrl(analyticsUrl: string): string {
    if (!this.analyticsProxyBaseUrl) {
      throw new Error('analyticsProxyBaseUrl is not configured.');
    }
    const parsed = new URL(analyticsUrl);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    return `${this.analyticsProxyBaseUrl}${pathAndQuery}`;
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

  private async executeAbsoluteUrlOnce<T>(
    options: AdoAbsoluteRequestOptions,
  ): Promise<AdoRequestResult<T>> {
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
}

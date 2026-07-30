import type { AdoHttpMethod } from '../constants/api';
import type { HttpClient, RequestInspectionRecord } from '../types/http';

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

export interface AdoAbsoluteRequestOptions {
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
}

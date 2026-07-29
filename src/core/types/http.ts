import type { AdoHttpMethod } from '../constants/api';

/**
 * Platform-agnostic HTTP contract used by the Azure DevOps client.
 * Web and React Native inject different `HttpClient` implementations.
 */
export interface HttpHeaders {
  readonly [name: string]: string;
}

export interface HttpRequest {
  method: AdoHttpMethod;
  url: string;
  headers?: HttpHeaders;
  body?: string | ArrayBuffer | Blob | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  bodyText: string;
  url: string;
}

export interface HttpClient {
  request(request: HttpRequest): Promise<HttpResponse>;
}

export interface RequestInspectionRecord {
  id: string;
  method: AdoHttpMethod;
  url: string;
  /** Headers with Authorization redacted. */
  headers: HttpHeaders;
  body: string | null;
  statusCode: number | null;
  statusText: string | null;
  responseBody: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  requestId: string | null;
}

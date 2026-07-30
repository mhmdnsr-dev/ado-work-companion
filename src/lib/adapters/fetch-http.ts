import type { HttpClient, HttpHeaders, HttpRequest, HttpResponse } from '@core/types';
import { AdoClientError } from '@core/types';
import { isAbortError } from '@core/utils';

function headersToRecord(headers: Headers): HttpHeaders {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

/**
 * Fetch-backed HttpClient for the web runtime.
 * Step 3 wires this into AzureDevOpsApi (often via the Next.js proxy route).
 */
export function createFetchHttpClient(): HttpClient {
  return {
    async request(request: HttpRequest): Promise<HttpResponse> {
      const controller = new AbortController();
      const timeoutMs = request.timeoutMs ?? 30_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const onExternalAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body ?? undefined,
          signal: controller.signal,
          cache: 'no-store',
          // Required so the browser sends the HttpOnly `ado_pat` cookie.
          credentials: 'include',
        });

        if (request.responseType === 'arrayBuffer') {
          const bodyArrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') ?? '';
          const bodyText = contentType.includes('json')
            ? new TextDecoder().decode(bodyArrayBuffer)
            : '';

          return {
            status: response.status,
            statusText: response.statusText,
            headers: headersToRecord(response.headers),
            bodyText,
            bodyArrayBuffer,
            url: response.url || request.url,
          };
        }

        const bodyText = await response.text();

        return {
          status: response.status,
          statusText: response.statusText,
          headers: headersToRecord(response.headers),
          bodyText,
          url: response.url || request.url,
        };
      } catch (error) {
        if (isAbortError(error)) {
          const timedOut = !request.signal?.aborted;
          throw new AdoClientError({
            message: timedOut
              ? `Request timed out after ${timeoutMs}ms`
              : 'Request was cancelled',
            kind: timedOut ? 'timeout' : 'abort',
            retryable: timedOut,
            cause: error,
          });
        }

        throw new AdoClientError({
          message: error instanceof Error ? error.message : 'Network request failed',
          kind: 'network',
          retryable: true,
          cause: error,
        });
      } finally {
        clearTimeout(timeoutId);
        request.signal?.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}

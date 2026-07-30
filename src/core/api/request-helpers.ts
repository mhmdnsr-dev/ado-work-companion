import type { AdoErrorPayload } from '../types/errors';

/** Encode a query id or path for `/_apis/wit/queries/{query}` (preserve `/`). */
export function encodeQueryResourcePath(idOrPath: string): string {
  return idOrPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function parseAdoErrorBody(bodyText: string): AdoErrorPayload | null {
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
export function adoFailureFromSuccessBody(data: unknown): {
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

export function suggestionsForStatus(status: number): string[] {
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

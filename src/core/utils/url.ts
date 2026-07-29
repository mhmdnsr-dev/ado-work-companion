import { encodeBase64Ascii } from './base64';

/**
 * Builds the Azure DevOps organization base URL.
 * Never includes the PAT — auth is always via the Authorization header.
 */
export function buildOrganizationBaseUrl(organization: string): string {
  const org = organization.trim().replace(/^\/+|\/+$/g, '');
  return `https://dev.azure.com/${encodeURIComponent(org)}`;
}

/**
 * Builds a project-scoped or organization-scoped resource URL.
 * When `project` is empty, the project segment is omitted.
 */
export function buildAdoResourceUrl(params: {
  organization: string;
  project?: string | null;
  path: string;
  apiVersion: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}): string {
  const base = buildOrganizationBaseUrl(params.organization);
  const project = params.project?.trim();
  const normalizedPath = params.path.replace(/^\/+/, '');

  const scoped =
    project && project.length > 0
      ? `${base}/${encodeURIComponent(project)}/${normalizedPath}`
      : `${base}/${normalizedPath}`;

  const url = new URL(scoped);
  url.searchParams.set('api-version', params.apiVersion);

  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * PAT → Basic auth header value per Microsoft docs:
 * username empty, password = PAT, Base64(":" + pat)
 * @see https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate
 */
export function buildPatAuthorizationHeader(pat: string): string {
  return `Basic ${encodeBase64Ascii(`:${pat}`)}`;
}

export function redactAuthorizationHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    next[key] = key.toLowerCase() === 'authorization' ? 'Basic ***REDACTED***' : value;
  }
  return next;
}

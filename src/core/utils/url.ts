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
  /** Team segment used by Work / Board APIs: /{org}/{project}/{team}/_apis/... */
  team?: string | null;
  path: string;
  apiVersion: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}): string {
  const base = buildOrganizationBaseUrl(params.organization);
  const project = params.project?.trim();
  const team = params.team?.trim();
  const normalizedPath = params.path.replace(/^\/+/, '');

  let scoped = base;
  if (project && project.length > 0) {
    scoped += `/${encodeURIComponent(project)}`;
    if (team && team.length > 0) {
      scoped += `/${encodeURIComponent(team)}`;
    }
  }
  scoped += `/${normalizedPath}`;

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
 * Builds an Azure DevOps Analytics OData URL.
 * @see https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/odata-query-guidelines
 */
export function buildAnalyticsODataUrl(params: {
  organization: string;
  project: string;
  /** Entity set name, e.g. WorkItemSnapshot */
  entity: string;
  /** OData version segment, default v4.0-preview */
  odataVersion?: string;
  apply?: string;
  orderby?: string;
  select?: string;
  top?: number;
}): string {
  const org = params.organization.trim();
  const project = params.project.trim();
  const entity = params.entity.trim().replace(/^\/+/, '');
  const version = (params.odataVersion ?? 'v4.0-preview').replace(/^\/+|\/+$/g, '');

  const url = new URL(
    `https://analytics.dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_odata/${version}/${entity}`,
  );

  if (params.apply?.trim()) url.searchParams.set('$apply', params.apply.trim());
  if (params.orderby?.trim()) url.searchParams.set('$orderby', params.orderby.trim());
  if (params.select?.trim()) url.searchParams.set('$select', params.select.trim());
  if (params.top != null) url.searchParams.set('$top', String(params.top));

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

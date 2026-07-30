import { AdoClientError } from '../../types/errors';
import { buildAnalyticsODataUrl } from '../../utils';
import type { AdoTransport } from '../transport';
import type { AdoRequestResult } from '../types';

/**
 * Queries Azure DevOps Analytics OData.
 * Requires PAT scope Analytics (read).
 * @see https://learn.microsoft.com/en-us/azure/devops/report/extend-analytics/odata-query-guidelines
 */
export async function queryAnalytics<T>(
  transport: AdoTransport,
  options: {
    project: string;
    entity: string;
    apply: string;
    orderby?: string;
    odataVersion?: string;
    signal?: AbortSignal;
  },
): Promise<AdoRequestResult<T>> {
  const project = options.project.trim();
  if (!project) {
    throw new AdoClientError({
      kind: 'validation',
      message: 'Select a project before querying Analytics.',
      retryable: false,
    });
  }

  const analyticsUrl = buildAnalyticsODataUrl({
    organization: transport.getOrganization(),
    project,
    entity: options.entity,
    apply: options.apply,
    orderby: options.orderby,
    odataVersion: options.odataVersion,
  });

  const analyticsProxyBaseUrl = transport.getAnalyticsProxyBaseUrl();
  const requestUrl = analyticsProxyBaseUrl
    ? transport.toAnalyticsProxyUrl(analyticsUrl)
    : analyticsUrl;

  return transport.executeAbsoluteUrl<T>({
    method: 'GET',
    adoUrl: analyticsUrl,
    requestUrl,
    signal: options.signal,
    attachPat: !analyticsProxyBaseUrl,
    retry: true,
  });
}

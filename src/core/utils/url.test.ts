import { describe, expect, it } from 'vitest';

import {
  buildAdoResourceUrl,
  buildAnalyticsODataUrl,
  buildOrganizationBaseUrl,
} from './url';

describe('buildOrganizationBaseUrl', () => {
  it('builds an org base URL and strips slashes', () => {
    expect(buildOrganizationBaseUrl('/contoso/')).toBe('https://dev.azure.com/contoso');
  });
});

describe('buildAdoResourceUrl', () => {
  it('builds org-scoped and project-scoped URLs with api-version', () => {
    const orgScoped = buildAdoResourceUrl({
      organization: 'contoso',
      path: '_apis/projects',
      apiVersion: '7.2',
    });
    expect(orgScoped).toContain('https://dev.azure.com/contoso/_apis/projects');
    expect(orgScoped).toContain('api-version=7.2');

    const projectScoped = buildAdoResourceUrl({
      organization: 'contoso',
      project: 'Fabrikam',
      path: '_apis/wit/workitems/1',
      apiVersion: '7.2',
      query: { $expand: 'Relations' },
    });
    expect(projectScoped).toContain('/Fabrikam/_apis/wit/workitems/1');
    expect(projectScoped).toContain('%24expand=Relations');
  });

  it('includes team segment for Work APIs', () => {
    const url = buildAdoResourceUrl({
      organization: 'contoso',
      project: 'Fabrikam',
      team: 'Fabrikam Team',
      path: '_apis/work/teamsettings',
      apiVersion: '7.2',
    });
    expect(url).toContain('/Fabrikam/Fabrikam%20Team/_apis/work/teamsettings');
  });
});

describe('buildAnalyticsODataUrl', () => {
  it('builds Analytics OData URLs with $apply', () => {
    const url = buildAnalyticsODataUrl({
      organization: 'contoso',
      project: 'Fabrikam',
      entity: 'WorkItemSnapshot',
      apply: 'filter(State ne null)',
      top: 10,
    });
    expect(url).toContain('https://analytics.dev.azure.com/contoso/Fabrikam/_odata/');
    expect(url).toContain('WorkItemSnapshot');
    expect(url).toContain('%24apply=');
    expect(url).toContain('%24top=10');
  });
});

import { APP_INFO, AUTHOR } from '@core/constants';
import { getSiteUrl } from '@/lib/site-url';

type JsonLdObject = Record<string, unknown>;

function absolute(path: string): string {
  const site = getSiteUrl();
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path.startsWith('/') ? path : `/${path}`, site).toString();
}

/** Sitewide @graph: Organization + WebSite + SoftwareApplication (schema.org). */
export function buildSiteGraph(): JsonLdObject {
  const site = getSiteUrl().origin;
  const orgId = `${site}/#organization`;
  const websiteId = `${site}/#website`;
  const appId = `${site}/#software`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: AUTHOR.name,
        url: AUTHOR.url,
        email: AUTHOR.email,
        sameAs: [AUTHOR.github, AUTHOR.linkedin],
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: APP_INFO.name,
        url: site,
        description: APP_INFO.description,
        inLanguage: 'en',
        publisher: { '@id': orgId },
        about: { '@id': appId },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': appId,
        name: APP_INFO.name,
        alternateName: APP_INFO.shortName,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'ProjectManagementApplication',
        operatingSystem: 'Web',
        softwareVersion: APP_INFO.version,
        description: APP_INFO.description,
        url: site,
        image: absolute('/icons/icon-512.png'),
        author: { '@id': orgId },
        publisher: { '@id': orgId },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: [
          'Update Azure DevOps work item status and remaining hours',
          'Comments and attachments within work items',
          'Saved Azure DevOps queries',
          'Sprint burndown dashboard',
        ],
      },
    ],
  };
}

export function buildHelpPageSchema(): JsonLdObject {
  const site = getSiteUrl().origin;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        '@id': `${site}/help#webpage`,
        url: `${site}/help`,
        name: `Help & About · ${APP_INFO.name}`,
        description: `Connect ${APP_INFO.shortName}, manage daily Azure DevOps work, and contact the author.`,
        isPartOf: { '@id': `${site}/#website` },
        about: { '@id': `${site}/#software` },
        mainEntity: { '@id': `${site}/help#howto` },
      },
      {
        '@type': 'HowTo',
        '@id': `${site}/help#howto`,
        name: `Connect ${APP_INFO.name} to Azure DevOps`,
        url: `${site}/help`,
        inLanguage: 'en',
        step: [
          {
            '@type': 'HowToStep',
            name: 'Create a Personal Access Token',
            text: 'Create an Azure DevOps PAT with Work Items read and write access.',
          },
          {
            '@type': 'HowToStep',
            name: 'Connect the companion',
            text: 'Open Settings, enter the organization and token, choose a project, save, and test the connection.',
          },
          {
            '@type': 'HowToStep',
            name: 'Manage daily work',
            text: 'Use Dashboard, Work Items, and Queries. Comments and attachments are available inside each work item.',
          },
        ],
      },
    ],
  };
}

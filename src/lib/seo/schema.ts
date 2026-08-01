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
          'Comments and attachments',
          'Queries and Estimate hub sessions',
          'Sprint burndown dashboard',
        ],
      },
    ],
  };
}

export function buildAboutPageSchema(): JsonLdObject {
  const site = getSiteUrl().origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${site}/about#webpage`,
    url: `${site}/about`,
    name: `About ${APP_INFO.name}`,
    description: `About ${APP_INFO.name} — who it’s for, daily task work, and how to get help.`,
    isPartOf: { '@id': `${site}/#website` },
    about: { '@id': `${site}/#software` },
    mainEntity: { '@id': `${site}/#software` },
  };
}

export function buildHowToUseSchema(): JsonLdObject {
  const site = getSiteUrl().origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${site}/how-to-use#howto`,
    name: `How to use ${APP_INFO.name}`,
    description: `Connect and use ${APP_INFO.shortName} for Azure DevOps tasks—status, hours, comments, and attachments.`,
    url: `${site}/how-to-use`,
    inLanguage: 'en',
    step: [
      {
        '@type': 'HowToStep',
        name: 'Create a Personal Access Token',
        text: 'In Azure DevOps, create a PAT with Work Items (and related) scopes.',
      },
      {
        '@type': 'HowToStep',
        name: 'Configure the companion',
        text: 'Enter your organization and PAT on the Configure page. Project is optional.',
      },
      {
        '@type': 'HowToStep',
        name: 'Work on tasks',
        text: 'Use Dashboard, Work items, Comments, Attachments, Queries, and Estimate.',
      },
    ],
  };
}

export function buildConfigurePageSchema(): JsonLdObject {
  const site = getSiteUrl().origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${site}/configure#webpage`,
    url: `${site}/configure`,
    name: `Configure ${APP_INFO.name}`,
    description:
      'Connect Azure DevOps so you can update tasks, hours, comments, and attachments.',
    isPartOf: { '@id': `${site}/#website` },
  };
}

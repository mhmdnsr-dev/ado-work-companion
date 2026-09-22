import { APP_INFO, AUTHOR } from '@core/constants';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-static';

/**
 * /llms.txt — LLM-oriented site summary (https://llmstxt.org/).
 * Also referenced by Chrome Lighthouse agentic browsing audits.
 */
export function GET() {
  const site = getSiteUrl().origin;

  const body = `# ${APP_INFO.name}
> ${APP_INFO.description}

${APP_INFO.shortName} is a Next.js Progressive Web App for daily Azure DevOps task work. Authentication uses a Personal Access Token stored in an encrypted HttpOnly cookie (never in the address bar). Organization and project preferences stay in browser localStorage. Work items and queries sync through the Azure DevOps REST API; comments and attachments are managed inside each work item.

Public pages are for onboarding and product context. Authenticated app routes require a saved connection and are crawl-disallowed.

## Docs
- [Help & About](${site}/help): PAT setup, daily workflow, installation, and contact
- [Configure](${site}/configure): Connect organization and PAT
- [Sitemap](${site}/sitemap.xml): Indexable public URLs (sitemaps.org protocol)
- [Robots](${site}/robots.txt): Crawl allow/disallow for public vs authenticated surfaces

## Product
- [Home](${site}/): Entry gate — configured users go to the dashboard; others to Configure
- [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2): Upstream API (default api-version ${APP_INFO.adoApiVersion})

## Optional
- [llms.txt specification](https://llmstxt.org/): Format used by this file
- [Chrome Lighthouse llms.txt](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt): Agent expectations for /llms.txt
- [Schema.org](https://schema.org/): Structured data on public pages (SoftwareApplication, WebSite, HowTo, AboutPage)
- [Author on GitHub](${AUTHOR.github})
- [Author on LinkedIn](${AUTHOR.linkedin})
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

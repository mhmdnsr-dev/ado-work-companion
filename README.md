# ADO Work Companion

A daily companion for **anyone with Azure DevOps tasks**—update status and remaining hours, add or read comments, and upload or view attachments without living in classic boards. Useful for developers, QA, product owners, and anyone else on the team.

Built with Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, React Hook Form, and Zod. Targets Azure DevOps REST API **7.2-preview** (configurable).

> Author: **Mohamed Nasr** · [mhmdnsr.dev@gmail.com](mailto:mhmdnsr.dev@gmail.com) · [LinkedIn](https://www.linkedin.com/in/mdnsr/) · [GitHub](https://github.com/mhmdnsr-dev)

---

## Features (current)

- **Configuration gate** — organization (required), project (optional), API version (`7.2-preview` default), access token
- **Help & About** — public guide for token setup, daily workflow, installation, and contact
- **PAT cookie lifetime** — remember token on this device for 7 / 14 (default) / 30 / 90 days or Forever (~400 days browser max)
- **Hybrid storage** — org/project/apiVersion/theme/cookie lifetime in `localStorage`; PAT in an **HttpOnly** encrypted cookie
- **Test Connection / Load Projects** use live form values
- **Searchable project combobox** with manual entry fallback
- **Proxied ADO calls** (`/api/ado/...`) — PAT decrypted from the cookie on the server
- **Dashboard**, **Work Items**, and **Queries** focused on daily work
- **Comments and attachments** managed inside each work item
- **Project selection** managed in the Settings connection form
- **PWA** — installable offline shell
- **Theme** — light / dark / system
- **Shared `src/core`** — portable for a future React Native / Expo app

---

## Quick start

```bash
cp .env.example .env.local
# Required: set ADO_SESSION_SECRET (openssl rand -base64 32)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script             | Description                            |
| ------------------ | -------------------------------------- |
| `npm run dev`      | Dev server (Turbopack)                 |
| `npm run build`    | Production build (webpack/PWA)         |
| `npm run start`    | Serve production build                 |
| `npm run test`     | Vitest unit tests (core helpers)       |
| `npm run test:e2e` | Playwright smoke (Chromium)            |
| `npm run verify`   | typecheck + lint + format + unit tests |

---

## Authentication model (hybrid)

```
Browser                         Next.js API                      Azure DevOps
   |                                |                                 |
   |  localStorage: org, project,   |                                 |
   |  apiVersion, theme,            |                                 |
   |  patCookieLifetime             |                                 |
   |                                |                                 |
   |  POST /api/config              |                                 |
   |  { pat, cookieLifetime }       |                                 |
   |------------------------------->|  encrypt PAT                    |
   |  Set-Cookie: ado_pat=…         |  (AES-256-GCM, HttpOnly,        |
   |  (Max-Age from lifetime)       |   Max-Age from cookieLifetime)  |
   |<-------------------------------|                                 |
   |                                |                                 |
   |  GET /api/ado/{org}/_apis/…    |                                 |
   |  Cookie: ado_pat               |                                 |
   |------------------------------->|  decrypt PAT from cookie        |
   |                                |-------------------------------->|
   |  JSON                          |<--------------------------------|
   |<-------------------------------|                                 |
   |                                |                                 |
   |  Reset                         |                                 |
   |  clear localStorage + DELETE   |  clear cookie                   |
```

| Data                                                                      | Where                                 | Readable by JS? |
| ------------------------------------------------------------------------- | ------------------------------------- | --------------- |
| Organization, project, API version, theme, PAT cookie lifetime preference | `localStorage`                        | Yes             |
| PAT                                                                       | HttpOnly cookie `ado_pat` (encrypted) | **No**          |
| Connection health (UI banner)                                             | `localStorage`                        | Yes             |

### PAT cookie lifetime

Controls how long **this app** keeps the encrypted `ado_pat` cookie (`Max-Age`) — **not** the expiry of the PAT in the Azure DevOps portal.

| Option  | Cookie Max-Age                            |
| ------- | ----------------------------------------- |
| 7 days  | 7d                                        |
| 14 days | **Default**                               |
| 30 days | 30d                                       |
| 90 days | 90d                                       |
| Forever | ~400 days (practical browser upper bound) |

Preference is stored in `localStorage` so Settings restores your last choice. Saving with an empty PAT field keeps the existing token and refreshes `Max-Age` to the selected lifetime.

### Reset

**Reset** clears connection keys in `localStorage` and expires the `ado_pat` cookie (`DELETE /api/config`). Settings returns to focused connection setup.

### Env

| Variable                        | Purpose                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ADO_SESSION_SECRET`            | **Required always.** Encrypts the PAT cookie (AES-256-GCM). Min 32 chars. Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL`          | Optional. Canonical origin for SEO (`metadataBase`, sitemap, robots). Defaults to `http://localhost:3000`         |
| `CORS_ALLOWED_ORIGIN`           | Optional. One origin or comma-separated list for credentialed CORS                                                |
| `RESEND_API_KEY` / contact vars | Optional. Help & About contact form (Resend)                                                                      |

Copy `.env.example` → `.env.local` and set a real secret before running. There is **no development fallback** — a missing or short secret fails the same way locally and in production.

Same-origin Next.js does not need CORS. Client fetches use `credentials: 'include'`.

> We do **not** write the PAT into a `.env` file or a server session database. The browser holds the encrypted cookie; the API encrypts/decrypts it with `ADO_SESSION_SECRET`.

---

## Routing

| Route       | Behavior                                                                    |
| ----------- | --------------------------------------------------------------------------- |
| `/`         | → `/dashboard` if configured; otherwise `/settings`                         |
| `/settings` | Connection setup before configuration; full preferences after configuration |
| `/help`     | Public Help & About page (PAT setup, workflow, installation, contact)       |
| App routes  | Require org + PAT cookie                                                    |

---

## Architecture (short)

```
src/
  app/api/config     # set / status / clear PAT cookie (+ cookieLifetime Max-Age)
  app/api/ado        # proxy; decrypts PAT from cookie
  lib/server/        # pat-cookie, CORS
  lib/config-api.ts  # browser → /api/config
  core/              # schemas, domain (localStorage prefs), API client
  features/          # dashboard, work items, queries, settings, help
```

API reference: [Azure DevOps REST API 7.2](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2) (app default query param: `api-version=7.2-preview`)

---

Made by [Mohamed Nasr](https://github.com/mhmdnsr-dev) — happy to connect on [LinkedIn](https://www.linkedin.com/in/mdnsr/).

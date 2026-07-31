# Azure DevOps API Explorer

Production-oriented **Azure DevOps REST API Explorer & Work Item Management** tool for internal engineering teams.

Built with Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, React Hook Form, and Zod. Targets Azure DevOps REST API **7.2**.

> Author: **Mohamed Nasr** · [mhmdnsr.dev@gmail.com](mailto:mhmdnsr.dev@gmail.com) · [LinkedIn](https://www.linkedin.com/in/mdnsr/) · [GitHub](https://github.com/mhmdnsr-dev)

---

## Features (current)

- **Configuration gate** — organization (required), project (optional), API version, PAT
- **Hybrid storage** — org/project/apiVersion/theme in `localStorage`; PAT in an **HttpOnly** encrypted cookie
- **Test Connection / Load Projects** use live form values
- **Searchable project combobox** with manual entry fallback
- **Proxied ADO calls** (`/api/ado/...`) — PAT decrypted from the cookie on the server
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

| Script           | Description                     |
| ---------------- | ------------------------------- |
| `npm run dev`    | Dev server (Turbopack)          |
| `npm run build`  | Production build (webpack/PWA)  |
| `npm run start`  | Serve production build          |
| `npm run test`   | Vitest unit tests (core helpers)|
| `npm run test:e2e` | Playwright smoke (Chromium)   |
| `npm run verify` | typecheck + lint + format + unit tests |

---

## Authentication model (hybrid)

```
Browser                         Next.js API                      Azure DevOps
   |                                |                                 |
   |  localStorage: org, project,   |                                 |
   |  apiVersion, theme             |                                 |
   |                                |                                 |
   |  POST /api/config { pat }      |                                 |
   |------------------------------->|  encrypt PAT                    |
   |  Set-Cookie: ado_pat=…         |  (AES-256-GCM, HttpOnly)        |
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

| Data                                      | Where                                 | Readable by JS? |
| ----------------------------------------- | ------------------------------------- | --------------- |
| Organization, project, API version, theme | `localStorage`                        | Yes             |
| PAT                                       | HttpOnly cookie `ado_pat` (encrypted) | **No**          |
| Connection health (UI banner)             | `localStorage`                        | Yes             |

### Reset

**Reset** clears connection keys in `localStorage` and expires the `ado_pat` cookie (`DELETE /api/config`). You return to `/configure`.

### Env

| Variable | Purpose |
|----------|---------|
| `ADO_SESSION_SECRET` | **Required always.** Encrypts the PAT cookie (AES-256-GCM). Min 32 chars. Generate with `openssl rand -base64 32` |
| `CORS_ALLOWED_ORIGIN` | Optional. One origin or comma-separated list for credentialed CORS |

Copy `.env.example` → `.env.local` and set a real secret before running. There is **no development fallback** — a missing or short secret fails the same way locally and in production.

Same-origin Next.js does not need CORS. Client fetches use `credentials: 'include'`.

> We do **not** write the PAT into a `.env` file or a server session database. The browser holds the encrypted cookie; the API encrypts/decrypts it with `ADO_SESSION_SECRET`.

---

## Routing

| Route        | Behavior                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| `/`          | → `/dashboard` if org in localStorage **and** PAT cookie exists; else `/configure` |
| `/configure` | Always available to create/update/reset                                            |
| App routes   | Require org + PAT cookie                                                           |

---

## Architecture (short)

```
src/
  app/api/config     # set / status / clear PAT cookie
  app/api/ado        # proxy; decrypts PAT from cookie
  lib/server/        # pat-cookie, CORS
  lib/config-api.ts  # browser → /api/config
  core/              # schemas, domain (localStorage prefs), API client
```

API reference: [Azure DevOps REST API 7.2](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2)

---

Made by [Mohamed Nasr](https://github.com/mhmdnsr-dev) — happy to connect on [LinkedIn](https://www.linkedin.com/in/mdnsr/).

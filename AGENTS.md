# AGENTS.md

Shared instructions for every coding agent (Claude Code, Cursor, Codex, …) working in this repo. Tool-specific notes live in `CLAUDE.md`; personal notes in the gitignored `CLAUDE.local.md`.

## Product

ADO Work Companion is a mobile-first PWA for people with Azure DevOps tasks: update state and remaining hours, comment, attach files, and see sprint progress without the full Boards UI. **Work Items is the most-used screen**, so treat it as the flagship.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (new-york, Radix), TanStack Query, React Hook Form + Zod, lucide icons, sonner toasts, `@ducanh2912/next-pwa`.

## Commands

| Command            | Use                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `npm run dev`      | Dev server (Turbopack)                                                                        |
| `npm run verify`   | typecheck + lint + prettier check + Vitest. Must pass before every commit                     |
| `npm run test:e2e` | Playwright (builds and serves prod on port 3456; ADO is mocked in `e2e/support/ado-mocks.ts`) |
| `npm run format`   | Prettier write (Tailwind class sorting included)                                              |

## Architecture

- `src/core/`: framework-free and portable (a React Native app is planned). `api/` (transport + resources), `domain/` (pure logic such as WIQL builders, hierarchy, and filters, **with unit tests next to the file**), `types/`, `schemas/`, `ports/`. Import via `@core/...`. No React or Next imports here.
- `src/features/<feature>/`: screen-level React (views, sheets, dialogs). Import via `@/features/...`.
- `src/components/ui/`: shadcn primitives. Prefer extending with variants over forking. `src/components/shared|layout|providers`: app-level building blocks.
- `src/app/`: routes only; `(app)` routes require a configured connection, `(setup)` routes do not. `src/app/api/ado/[...path]` proxies ADO and reads the PAT from an encrypted HttpOnly cookie. **Never expose, log, or persist a PAT client-side.**
- Theme tokens are oklch CSS variables in `src/app/globals.css` (light `:root` + `.dark`), surfaced to Tailwind via `@theme inline`. Use tokens, never raw hex, in components.

## Design

Read `DESIGN.md` before any UI work. It is the design north star (direction, tokens, patterns) and holds the **Redesign Roadmap**. The app is being redesigned gradually, one slice per PR. New UI must follow DESIGN.md even when neighbouring legacy screens do not.

## Git workflow

- `main` = released. `development` = integration. Work on `feat/<name>` / `fix/<name>` branches off `development`, PR into `development`, then `development` → `main`.
- Conventional Commits (`feat(work-items): …`, `fix(pwa): …`, `test(e2e): …`, `docs: …`).
- Do not commit `.env*`, `.lighthouse/`, test artifacts, or `CLAUDE.local.md`.

## Feature notes (`.agents/features/<feature>.md`)

For any multi-session feature, keep a working note on its branch at `.agents/features/<feature-name>.md`:

```md
# <feature-name>

Branch: feat/<feature-name> · Started: YYYY-MM-DD

## Goal

## Decisions (with why)

## Open questions

## Progress log (dated)

## Verification evidence (commands run, scores, screenshots)
```

Update it at the end of each session so the next agent can resume. **Delete it in the last commit before the PR to `main`**. CI (`.github/workflows/no-feature-notes.yml`) fails PRs into `main` that still contain feature notes. Durable decisions belong in `DESIGN.md` or this file before the note is deleted.

## Quality gates (user-facing changes)

1. `npm run verify` passes; e2e specs touching the screen are updated and pass.
2. Mobile first: check at 360–412px wide and at desktop, in light and dark. Touch targets ≥ 44px (`.touch-target`), safe areas respected.
3. Lighthouse (mobile, navigation) on touched routes: **Accessibility ≥ 0.9, Best Practices ≥ 0.9**. Fix all Critical/Serious a11y failures. Write reports to `.lighthouse/` (gitignored); do not commit them.
4. Respect `prefers-reduced-motion` (a global rule in `globals.css` already shortens animations; don't fight it).
5. Keyboard accessible: visible focus, correct ARIA roles (e.g. tree pattern for hierarchies), no keyboard traps.

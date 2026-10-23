# AGENTS.md

Shared instructions for every coding agent (Claude Code, Cursor, Codex, …) working in this repo. Tool-specific notes live in `CLAUDE.md`; personal notes in the gitignored `CLAUDE.local.md`.

## Product

ADO Work Companion is a mobile-first PWA for people with Azure DevOps tasks: update state and remaining hours, comment, attach files, and see sprint progress without the full Boards UI. **Work Items is the most-used screen**, so treat it as the flagship.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (new-york, Radix), TanStack Query, React Hook Form + Zod, lucide icons, sonner toasts, `@ducanh2912/next-pwa`.

## Mobile-first (non-negotiable)

Most people use the app on their phone, usually as the installed PWA. Every change is designed for the phone first and then enhanced for larger screens, never the other way round.

- Design and build at **360px wide first** (reference device: Samsung Galaxy A55, 360×800), then add to the layout at `md` and up. Use Tailwind's mobile-first order: unprefixed classes are for phones, `md:` and up add to them.
- Don't squeeze desktop layouts onto phones. Extra table columns, side-by-side panels, and hover-only affordances belong at `md` and up. On a phone, put secondary data in a wrapping meta line, a sheet, or a disclosure.
- Long real ADO data must fit: titles such as "Q4-CORE-WT1-T3253-004 Add Sponsored Flights…" and custom states such as "Ready for UAT". Let it wrap or clamp to 2 lines; never let it overflow or collide with neighbouring text.
- Keep clear of the fixed chrome (app bar, bottom nav, floating action button), use touch targets of at least 44px, respect safe areas, and avoid horizontal page scroll.

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

Update it at the end of each session so the next agent can resume. **Delete it in the final commit of the feature's own PR**, so it stays in the branch history but never reaches `development` (releases to `main` can follow a merge immediately). CI (`.github/workflows/no-feature-notes.yml`) fails PRs into `main` that still contain feature notes; `main` should also require that check in branch protection. Durable decisions belong in `DESIGN.md` or this file before the note is deleted.

## Quality gates (user-facing changes)

1. `npm run verify` passes; e2e specs touching the screen are updated and pass.
2. Mobile first: check at **360px** (and 390–412px) with realistic long data before desktop, in light and dark. Confirm nothing overflows its row and there's no horizontal scroll. Touch targets ≥ 44px (`.touch-target`), safe areas respected.
3. Lighthouse (mobile, navigation) on touched routes: **Accessibility ≥ 0.9, Best Practices ≥ 0.9**. Fix all Critical/Serious a11y failures. Write reports to `.lighthouse/` (gitignored); do not commit them.
4. Respect `prefers-reduced-motion` (a global rule in `globals.css` already shortens animations; don't fight it).
5. Keyboard accessible: visible focus, correct ARIA roles (e.g. tree pattern for hierarchies), no keyboard traps.

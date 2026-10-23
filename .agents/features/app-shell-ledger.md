# app-shell-ledger

Branch: feat/app-shell-ledger · Started: 2026-10-23 · Depends on #21

## Goal

Roadmap slice 4: the app-wide shell. Ledger dark palette everywhere, a one-row phone app bar with a real `<h1>`, a clearer bottom nav, a sidebar accent, and motion tokens.

## Decisions (with why)

- The phone `<h1>` lives in the app bar: pages already hide their headers below md, so this gives exactly one visible `<h1>` per breakpoint without touching every page.
- The project pill replaces the stacked org/project lines (3 lines → 1 row, 56px). Its dot reuses connection health.
- Typography scale deferred: IBM Plex plus the existing Tailwind scale already reads well. Revisit with the dashboard (slice 5).

## Verification evidence

- `npm run verify` (53 tests), `npm run test:e2e` 31/31 (smoke covers the phone shell at 320/390/430/740 widths and toast placement).
- axe (WCAG 2.1 AA + best-practice) on /work-items, /dashboard, /queries at 360px, light and dark: 0 violations (the earlier `page-has-heading-one` is fixed).
- Live desktop on NDC Portal: dark ground, sidebar, chips; no console errors.

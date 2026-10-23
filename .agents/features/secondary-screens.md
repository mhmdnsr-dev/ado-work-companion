# secondary-screens

Branch: feat/secondary-screens · Started: 2026-10-23 · Status: shipped (2026-10-23, #28 → main via #29)

## Goal

Roadmap slice 6, phone-first: Queries, Settings, and Help in the new style, plus consistent empty, loading, and error states.

## Plan

1. Shared states: `EmptyState`, `ErrorState` (with Retry), row skeletons; applied in Work Items, Queries, and Dashboard.
2. Queries: a compact searchable folder tree (no fixed-height card); opening a query runs it immediately, with results as tree rows; WIQL behind a disclosure; the empty preview pane only from md.
3. Settings: a grouped settings list; a status row with Test; the token field with the eye button inside; Test and Save side by side; Reset in a danger zone; Appearance as a segmented control.
4. Help: a compact phone header; sticky, scrollable section tabs.

## Decisions (with why)

- Feature notes now stay on main and are pruned periodically (user, 2026-10-23); this note follows that rule.

## Open questions

- The connection form still uses its own card, not a grouped section. Converting it means touching the shared first-run setup screen too, so it was left for later.

## Progress log

- 2026-10-23: Built all four parts. Also fixed: light primary contrast (4.44 → 4.89:1, app-wide), a duplicate Help landmark, "Clear local preferences" missing the collapsed-tree key, and e2e sign-ins hitting the production rate limit (now one sign-in per worker, cookie reused).
- 2026-10-23: "Before" screenshots at 360px. Queries: a fixed-height library card, a placeholder pane on phones, and an extra tap to run a query. Settings: nested cards, a cramped token row, stacked centred buttons. Help: a large logo and clipped tabs.

## Verification evidence

- `npm run verify` (62 unit tests); `npm run test:e2e` 39/39, twice in a row (new: query opens and runs, folders, search with paths and the empty state, WIQL disclosure, theme segmented control).
- axe (WCAG 2.1 AA + best-practice) at 360px, light and dark, on /queries, /queries?query=…, /settings, /help: 0 violations.
- Live, read-only, NDC Portal: the real query tree loads (My Queries, Shared Queries, nested folders); no errors.

# secondary-screens

Branch: feat/secondary-screens · Started: 2026-10-23 · Status: in progress

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

## Progress log

- 2026-10-23: "Before" screenshots at 360px. Queries: a fixed-height library card, a placeholder pane on phones, and an extra tap to run a query. Settings: nested cards, a cramped token row, stacked centred buttons. Help: a large logo and clipped tabs.

## Verification evidence

# work-items-hierarchy-redesign

Branch: feat/work-items-hierarchy-redesign · Started: 2026-10-23

## Goal

Roadmap slice 1 (DESIGN.md): replace the stacked work item cards with a tree-table. Parents and children must look clearly different, with an animated expand/collapse chevron, rails, rollups, keyboard navigation, and the collapsed state remembered per project.

## Decisions (with why)

- Direction: "C's structure with A's dark mode" (user's pick from the mock canvas https://claude.ai/artifact/4yFWN2dFqREKyH1RFj11fW).
- Font: IBM Plex Sans/Mono app-wide (user asked for C's Plex, 2026-10-23), replacing Geist.
- Context rows = ancestors that `enrichHierarchyItems` loads only for grouping (not matched, not expanded for children). They are tracked explicitly instead of inferred from tree shape.
- The chevron is not a nested `<button>`: axe flags nested-interactive inside `treeitem`. The row owns keyboard toggling; the gutter is a pointer-only hit area.
- The global `.dark` palette is unchanged in this slice; adopting the Ledger ground app-wide is slice 2.
- The display mode moves from the filter panel to a List/Tree toggle in the list toolbar. Tree is the default (user request); a saved "list" view still wins.

## Open questions

- NDC Portal: the parents of 3 stories (62038, 62386) come back `null` from ADO (no access, or another project), so those stories stay roots. That is expected behaviour, not a bug.

- Phone Work Items has no visible `<h1>` (axe `page-has-heading-one`, moderate). The header is `hidden` below `md`, which predates this slice; fix it with the shell in slice 2.

## Progress log

- 2026-10-23: Full ancestry (up to 4 levels) loaded as context rows, and context rows left without children are pruned after the Open filter. Custom process types use their ADO icon and colour. Mocks gained Epic 501 → Feature 401 → Story 202 and a "Meetings" item. Verified live: the Meetings headphones glyph shows, and the inaccessible parents are skipped without errors.

- 2026-10-23: DESIGN.md written; branch created.
- 2026-10-23: Tree is the default view; IBM Plex app-wide.
- 2026-10-23: Live check on tilde-technology / NDC Portal (62 items, 7 groups). Fixed: custom states now use the process category and colour from `workitemtypes` ("Ready for UAT", Task "Resolved" = InProgress); hours keep two decimals (0.25); the State column wraps long names.
- 2026-10-23: Domain helpers (state categories, rollup, visible-row flattening, collapsed persistence) with unit tests. `WorkItemTree` replaces `WorkItemHierarchyList` and `WorkItemListCard` (also used by Queries). List/Tree toggle and Expand/Collapse all moved to the list toolbar. Context ancestors are tracked in `enrichHierarchyItems`.

## Verification evidence

- 2026-10-23: `npm run verify` passes (47 unit tests). `npm run test:e2e`: 27/27 pass, including new keyboard-navigation and collapsed-persistence tests.
- 2026-10-23: Playwright screenshots, phone 390×844 and desktop 1280, light and dark (mocked ADO). axe (wcag2a/aa, wcag21aa, best-practice) on `/work-items` tree mode, light and dark: the only violation is the pre-existing `page-has-heading-one`.
- 2026-10-23 (live, dev server, real ADO): collapse via chevron and ←/→ works, focus is kept, collapsed state survives a reload per org/project, Expand all restores 62 rows, no console errors. The phone viewport couldn't be emulated in that Chrome window (covered by the Playwright 390px runs instead).

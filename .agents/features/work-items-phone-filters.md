# work-items-phone-filters

Branch: feat/work-items-phone-filters · Started: 2026-10-23

## Goal

Roadmap slice 2: a phone-first Work Items header. Search row + Filters button, ADO quick views, removable filter chips, a real bottom sheet for filters, and a one-row toolbar.

## Decisions (with why)

- Quick views are presets over `scope` + `assignedTo`, not a separate mode, so they combine with the other filters and persist with Save filters.
- The same sheet is used at every width (bottom on phones, right from md) instead of a desktop-only inline panel: one code path, phone-first.
- Filter `useState`s collapsed into one `filters` object with `patchFilters`, to keep the 1,200-line view manageable.
- A chip for "Only my matches" (children off): live data showed 7 vs 62 items with no visible reason.
- No swipe-to-dismiss on the sheet (would need `vaul`); overlay tap, Esc, and the close button cover it.

## Progress log

- 2026-10-23: Built and verified. Live on NDC Portal: quick views return Following 0, Mentioned 0, My activity 37 items / 10 groups; saved Team/Sprint/children filters show as chips.

## Verification evidence

- `npm run verify` (50 unit tests), `npm run test:e2e` 29/29 (new: quick views send the right WIQL macros; search/status chips and badge count).
- Playwright 360×800 light/dark: header, sheet, chips; no horizontal scroll.

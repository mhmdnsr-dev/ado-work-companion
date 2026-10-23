# work-item-quick-updates

Branch: feat/work-item-quick-updates · Started: 2026-10-23 · Depends on #20

## Goal

Roadmap slice 3: the daily actions (change state, log time) as one-tap quick updates at the top of the detail sheet, plus a phone-first header and footer.

## Decisions (with why)

- Quick updates save immediately (no Save button): they are single-field, reversible changes. State changes get an Undo toast, and hours are visible in the toast.
- "Log work" moves hours Remaining → Completed, matching how ADO burndown works. The pure math lives in `src/core` with tests.
- "Removed" is excluded from the chips: too destructive for one tap.
- Found and fixed a real bug: toast actions were untappable while any Radix modal was open (body has pointer-events: none). Fixed globally in Sheet/Dialog.
- No live PATCH against real ADO data. The live check was read-only; the user should try a real log-work.

## Verification evidence

- `npm run verify` (53 unit tests), `npm run test:e2e` 31/31 (new: log work + stepper + list refresh; state change + Undo; no Removed chip). The e2e mock now applies PATCHes to a per-page store.
- Playwright 360×800 light/dark; no horizontal scroll.
- Live (read-only): NDC Portal task 62026 shows all 10 process states with ADO colours.

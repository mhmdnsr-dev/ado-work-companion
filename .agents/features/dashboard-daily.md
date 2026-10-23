# dashboard-daily

Branch: feat/dashboard-daily · Started: 2026-10-23

## Goal

Roadmap slice 5: the Dashboard as a phone-first daily start screen (your numbers, your open work with Quick update, readable charts).

## Decisions (with why)

- Followed the dataviz skill. Hero figure + meter + KPI tiles instead of eight chips; emphasis burndown with crosshair and data table; stacked bar for states.
- The state colours failed the CVD validator, so the bar uses a validated ordinal blue ramp (states are an ordered progression).
- One counted set (leaf work, process categories) for every number, after the first build showed hero 6h vs chart 4h vs open 4 vs list 2. Sprint items are now loaded with relations to find leaves.
- Connection card removed (the app bar pill and Settings cover it); Favorites shown only from md (they repeat the bottom nav on phones); unused chart components deleted.
- Tree columns moved to container queries so half-width columns keep the phone layout.

## Verification evidence

- `npm run verify` (57 unit tests), `npm run test:e2e` 33/33 (new dashboard test: hero 6h, open items 2, open-work order, state bar label, data table, open → Quick update).
- axe at 360 light/dark and 1280 dark: 0 violations; no horizontal scroll.
- Live, read-only, NDC Portal: hero 19.5h = chart end 19.5h; 7 open = 7 rows = 5+2 in the state bar; "Day 11 of 14, 3 days left"; no console errors.

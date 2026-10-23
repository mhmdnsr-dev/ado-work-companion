# log-work-validation

Branch: feat/log-work-validation · Started: 2026-10-23 · Keep until the user says "ready to merge"

## Goal

Quick update → Log work: validate input without blocking real over-runs.

- Block: not a number, ≤ 0, more than 40h in one log (likely a typo). Round to 2 decimals.
- Allow, but explain in the preview: more than Remaining ("1.5h over the remaining estimate"), and Completed past the Original Estimate.
- Over-run with work still left: when a log would take Remaining to 0, offer "Remaining after" in the same save.
- When Remaining hits 0 on open work, the toast offers "Mark as <done state>" (one tap, with Undo).

## Decisions (with why)

- No hard cap at Remaining: estimates are guesses, and blocking pushes people to under-report. ADO doesn't block it either (user agreed, 2026-10-23).
- 40h cap instead of 24h, so a week logged in one go still works.
- The math lives in `src/core` (`parseHoursInput`, `planLogWork`), with unit tests.

## Open questions

## Progress log

- 2026-10-23: Plan agreed with the user; branch created.
- 2026-10-23: Built `parseHoursInput` and `planLogWork` (core, tested) and the Quick update UI: inline error plus disabled Log, over-run/over-estimate notes, "Remaining after" in the same save, and a "Mark as <done>" toast action. The feature-note lifecycle in AGENTS.md now keeps the note until the user says "ready to merge".

## Verification evidence

- `npm run verify`: 58 unit tests (new: input parsing, over-run, remaining override, no-estimate case).
- `npm run test:e2e` 35/35 (new: impossible amounts blocked; 5h over 4h with 2h still left = one PATCH; nothing left → "Mark as Closed" → state Closed).
- Playwright at 360px, light and dark: over-run and error states.

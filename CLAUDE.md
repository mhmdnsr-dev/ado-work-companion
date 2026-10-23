@AGENTS.md

# Claude Code notes

Everything in AGENTS.md applies. This file adds Claude-specific workflow only.

## Redesign slices

- Start each roadmap slice (see `DESIGN.md`) in plan mode, then create or resume `.agents/features/<feature>.md`.
- Design tooling: the `impeccable` skill (critique → shape → build → polish/finish review), `frontend-design` for typography and aesthetics, `design:design-critique` and `design:accessibility-review` for reviews, and `dataviz` for any chart. For big visual choices, show options as a private Artifact mockup before writing app code.
- Keep `DESIGN.md` current when tokens or patterns change; tick the roadmap item when a slice merges.

## Live verification

- **chrome-devtools MCP**: `emulate` a phone viewport, `take_screenshot` before/after (light + dark), `lighthouse_audit` (mobile, navigation) → `.lighthouse/`.
- **Playwright**: `npm run test:e2e` for mocked flows; it reuses a running server on port 3456 locally.
- **Real ADO data**: ask the user to sign in or enter their PAT in the browser themselves, then drive the app via claude-in-chrome or chrome-devtools. Never read, echo, or store the PAT.

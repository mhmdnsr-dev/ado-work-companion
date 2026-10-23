# DESIGN.md

The design north star for ADO Work Companion. Every UI change follows this file, even when neighbouring legacy screens do not yet. Update it in the same PR when a token or pattern changes.

## Direction: "Boards+ structure, Ledger dark"

Chosen 2026-10-23 from three mock directions:

- **Structure (from Boards+)**: feels like a refined Azure Boards. People already know ADO, so we keep its mental model (type colours, tree rows, state dots, Remaining column) and remove its clutter. Work is shown as **rows in a tree-table**, not stacked cards.
- **Dark mode (from Ledger)**: a deep blue-black ground, quiet borders, luminous but desaturated type/state colours, monospace IDs and numbers. Dense, calm, keyboard-friendly.

### Principles

1. **Hierarchy is visible at a glance.** Parents and children never look the same. A parent row is a shaded band with a bold title and a progress rollup. A child row is plain, with its owner. Guide rails connect children to their parent.
2. **Colour carries meaning, never decoration.** Hue is reserved for work item _type_ (glyph) and _state_ (dot). Everything else is neutral. State is always shown with a text label too, never colour alone.
3. **Numbers are data.** IDs, hours, and counts use the mono font with tabular figures, right-aligned in columns.
4. **Phone first, always.** Users are mainly on phones (see AGENTS.md › Mobile-first). Design at 360px first. On a phone a row is a two-line title, a wrapping meta line (state, type/ID, rollup, owner), and a single Rem. column. Wider screens add columns (Assigned to, State) rather than stretching things.
5. **Motion explains state changes only.** The chevron rotates, revealed rows fade and slide in about 4px. Nothing loops. The global reduced-motion rule applies.

## Tokens (`src/app/globals.css`)

Existing shadcn tokens (`--background`, `--muted`, `--border`, `--primary`, …) stay the base. Added for work items:

| Token                 | Use                             | Light (Boards+) | Dark (Ledger) |
| --------------------- | ------------------------------- | --------------- | ------------- |
| `--wit-epic`          | Epic glyph                      | `#C25E00`       | `#F5A25D`     |
| `--wit-feature`       | Feature glyph                   | `#773B93`       | `#C4A1F5`     |
| `--wit-story`         | User Story / PBI / Requirement  | `#0078A8`       | `#6CC4EE`     |
| `--wit-task`          | Task                            | `#9A7A00`       | `#E9C46A`     |
| `--wit-bug`           | Bug                             | `#CC293D`       | `#F2858B`     |
| `--wit-other`         | Any other type                  | `#5D6673`       | `#9AA1AE`     |
| `--state-proposed`    | New, To Do, Proposed…           | `#8A919B`       | `#8B93A1`     |
| `--state-in-progress` | Active, Committed, In Progress… | `#007ACC`       | `#6F9BF2`     |
| `--state-resolved`    | Resolved                        | `#D17F00`       | `#E8B65A`     |
| `--state-completed`   | Done, Closed                    | `#2F8F2F`       | `#62CF8E`     |
| `--state-removed`     | Removed, Cut                    | `#A0A6AE`       | `#5C6370`     |

State dots use the project's own process colours from `workitemtypes` when ADO provides them (near-white ones fall back to the category token); the `--state-*` tokens are the fallback. Values are stored as oklch, and Tailwind exposes them as `text-wit-*`, `bg-state-*`, and so on. Glyph colours meet 3:1 against `--background` (non-text). State labels use `--foreground`; only the dot is coloured.

Type: IBM Plex Sans (UI) and IBM Plex Mono (IDs, hours, counts) via `next/font`, falling back to Segoe UI, the font ADO itself uses. Sizes: row title 14px (`text-sm`), meta 12px (`text-xs`), column headers 11px uppercase with tracking.

## Patterns

### Work item tree-table (`src/features/work-items/work-item-tree.tsx`)

- ARIA tree: `ul[role=tree]` > `li[role=treeitem]` with `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` (parents only), and `aria-selected` (the open item). Roving tabindex: one row is tabbable. ↑/↓ move, → expands or enters, ← collapses or goes to the parent, Home/End jump, Enter/Space opens.
- **Parent row**: `bg-muted/50` band, semibold title, rotating chevron (the whole 44px gutter is the hit area), a rollup bar plus "done/total" in the meta line, and summed remaining hours in Rem. A collapsed parent shows a child-count pill.
- **Child row**: plain background, the assignee in the meta line, its own hours.
- **Context row**: an item that doesn't match the filters itself but groups the items below it (for example a story assigned to someone else, above your task). Its glyph and title are muted, with **no extra label**: ADO users already read parents as grouping. It still rolls up the children loaded under it, so with **Show all children** off a story shows your share: your tasks' progress and hours.
- **Ancestry**: the full parent chain above the matches is loaded (up to 4 levels: Story → Feature → Epic → …) as context rows. Their other children are never loaded. Ancestors the token can't read are skipped, and closed ancestors are hidden in the Open view.
- **Custom types**: standard types use the `--wit-*` tokens. Custom process types (for example "Meetings") use their ADO icon (mapped to a matching Lucide icon) and their ADO colour, with lightness clamped per theme (`.wit-custom-glyph`) so pale or deep process colours stay legible.
- **Rails**: a 1px `--border` line per ancestor level, with an elbow into each child.
- **Selected (open) row**: `bg-primary/10` plus a 3px inset primary bar on the leading edge.
- **Columns**: phones have Title (flex, 2-line clamp) and Rem. (mono, right-aligned); the state dot and label lead the meta line. From `md` up: Title (1 line), Assigned to, State, Rem. The column header is decorative (`aria-hidden`).
- **Indent**: `--tree-indent` is 14px on phones and 20px from `md` up, so deep Epic → Task chains keep room for titles.
- **Tree is the default view.** Flat list mode reuses the same rows at level 1, so the two modes look the same.

### Work Items header and filters (`work-items-view.tsx`, `work-item-filters-sheet.tsx`)

- **One search row**: a `type="search"` field (the keyboard's search key submits it; an in-field clear button) plus a **Filters** button with a count badge. A separate Search button appears only from `md` up.
- **Quick views**: underline tabs (Assigned to me, Following, Mentioned, My activity) mirroring the ADO Work Items hub. They're backed by the `@Me`, `@Follows`, `@RecentMentions`, and `@MyRecentActivity` WIQL macros. On phones they scroll sideways with an edge fade.
- **Active filter chips**: every non-default filter (search, type, status, team, sprint, a specific assignee, "Matching children only") is a removable chip, plus "Clear all" when there are two or more. Chips are 36px tall with a 44px hit area (`::before`).
- **Filters sheet**: a bottom sheet on phones (grab handle, max 88dvh, safe-area padding) and a right sheet from `md` up. Filters apply live. The footer has Reset and Save in one row and a full-width "Show work items".
- **Toolbar**: one row with the count (short on phones), List/Tree (icon-only on phones), a single Expand/Collapse toggle, and Refresh.

## Redesign Roadmap

One PR per slice, ordered by phone impact (see AGENTS.md › Mobile-first). Tick each when it merges to `main`.

- [x] 1. Work Items tree-table and rows (#16, #17)
- [ ] 2. Work Items phone header and filters: one-row search, filter chip bar, a proper `Sheet` bottom sheet, ADO-style quick views (Assigned to me / Following / Recently updated)
- [ ] 3. Work item detail sheet: quick updates (one-tap state, remaining-hours stepper) above the full form
- [ ] 4. App-wide shell: adopt the Ledger dark ground, phone app bar and bottom nav, page `<h1>`, typography scale, motion tokens
- [ ] 5. Dashboard (status cards, sprint charts; use the `dataviz` skill)
- [ ] 6. Queries, Settings, Help; empty, loading, and error states

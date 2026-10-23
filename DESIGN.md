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

State dots use the project's own process colours from `workitemtypes` when ADO provides them (near-white ones fall back to the category token); the `--state-*` tokens are the fallback. Light `--primary` is L 0.54 (`#1d6ec6`): 4.9:1 under button text and 5.1:1 as text, after axe flagged the original at 4.44:1. Values are stored as oklch, and Tailwind exposes them as `text-wit-*`, `bg-state-*`, and so on. Glyph colours meet 3:1 against `--background` (non-text). State labels use `--foreground`; only the dot is coloured.

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

### Work item detail sheet (`work-item-detail-sheet.tsx`, `work-item-quick-update.tsx`)

- **Header**: the type and mono `#id` on a small line, then the work item title (2-line clamp) as the sheet title, and a 44px close button.
- **Quick update card** (first thing in the sheet). These are the daily actions, one tap each:
  - **State chips**: the type's process states with ADO colours. A tap saves the state immediately, and the toast offers **Undo**. "Removed" is never a chip.
  - **Log work composer**: the +0.5h / +1h / +2h / +4h chips and the −/+ stepper only **build an amount** (or type one, e.g. 2.5). A live preview shows both effects ("Remaining 4 → 1.5h · Completed 0 → 2.5h"), and one **Log 2.5h** button saves it in a single PATCH (`buildLogWorkPatches`; Remaining never goes below 0).
  - **Validation**: block only impossible input (not a number, ≤ 0, more than 40h in one log). Show the reason under the field and disable Log. Hours round to 2 decimals.
  - **Over-runs are allowed, and explained**: estimates are guesses. The preview notes "1h more than the remaining estimate." and "Completed goes 1h past the original 8h estimate." in muted text with an info icon, not as errors.
  - **Remaining after**: when a log would clear Remaining, a field asks how much is still left (default 0), saved in the same PATCH (`planLogWork`).
  - **Close nudge**: when Remaining reaches 0 on open work, the success toast offers "Mark as <process done state>" (Undo follows from the state change).
  - **Adjust remaining only**: a disclosure for re-estimates ("Set remaining to …h"), labelled so it's clear Completed doesn't change. Save is enabled only for a valid, changed number.
- **Full form** below, unchanged. **Footer**: one row on phones (delete icon, Close, Save changes) with safe-area padding.
- **Toasts over modals**: `[data-sonner-toaster]` keeps pointer events, and Sheet/Dialog ignore outside-interactions on toasts, so toast actions work while a sheet is open.

### App shell (`src/components/layout`)

- **Dark ground (Ledger)**: background `#0E1014`, cards `#14171D`, borders `#232833`, text `#E7E9EE`, muted text `#9AA1AE` (7.3:1), primary `#5B8DEF` (5.9:1). Values are stored as oklch in `.dark`. Light keeps the Boards+ white and ADO blue.
- **Phone app bar**: one 56px row. The page title is the phone `<h1>` (page headers are `hidden` below `md`, so each breakpoint has exactly one visible `<h1>`). A project pill on the right shows the project and a connection-health dot, and links to Settings. It uses translucent `bg-background/85` with `backdrop-blur`.
- **Bottom nav**: the active tab gets a `bg-primary/15` pill behind its icon and a semibold label; the bar uses the same translucent blur.
- **Sidebar (md+)**: the active item gets a 3px leading accent bar instead of a ring.
- **Motion tokens** (`@theme`): `--ease-standard`, `--ease-emphasized`, `--duration-quick` (150ms), `--duration-moderate` (220ms). Use them as `duration-(--duration-moderate) ease-(--ease-standard)`.

### Dashboard (`src/features/dashboard`)

A daily start screen, built with the `dataviz` method (form first, colour last, validated):

- **Scope row** above everything it filters: one "Team · Member" button opening a sheet, plus Refresh. Below it, the sprint name and dates.
- **Summary**: a **hero figure** (remaining hours, 48px sans, proportional digits), a **days-left meter** ("Day 11 of 14", counting both ends; the track is a lighter step of the fill's hue), and four stat tiles (Done %, Completed h, Open items, Closed items).
- **One counted set**: every number (hero, tiles, burndown end, state bar, open-work list) is computed over **leaf** sprint work (no child links, not Removed), with "done" from the process state categories (`summarizeSprintWork`, `isCountedSprintWork`). Never mix sources on one screen.
- **Open work**: leaf items not done, in progress first, as tree rows (max 20, then a link to Work Items). A tap opens the work item sheet with Quick update. On phones it sits right after the summary; from `lg` it's the left column.
- **Burndown**: emphasis form. Remaining is the accent 2px line with a 10% wash, the end dot (r4, 2px surface ring) and the one direct label; ideal is a grey 2px context line. Two series, so there's a line-key legend. Hairline solid gridlines on round ticks. A crosshair tooltip works with pointer and ←/→/Home/End, and **Show data** opens a table, so no value is hover-only. Rendered at measured pixel width (`useElementWidth`), not a scaled viewBox.
- **By state**: part-to-whole as one stacked bar (12px, 2px surface gaps, 4px outer radius) with a counted legend. States are ordered by progress, so they use an **ordinal blue ramp** (`--progress-*`, validated with `validate_palette.js --ordinal` in light and dark). Categorical state colours failed the CVD check (Resolved vs Done under protan, ΔE 2.3).
- **Responsive by container**: tree columns use container queries (`@container` with `@2xl:`), so a half-width column keeps the phone row layout.

### States (`src/components/shared/states.tsx`)

- **EmptyState**: an icon in a muted circle, a title that says what's missing, one line on why, and **one** action that helps (for example "Clear filters" or "New work item"). Dashed border.
- **ErrorState**: a destructive alert with the message, ADO's suggestions when it returns any, and **Retry** (44px, shows progress).
- **RowsSkeleton**: placeholder rows shaped like tree rows, so a list doesn't jump when it loads. Use it for every list load; refetches keep the old render dimmed instead.

### Queries, Settings, Help

- **Queries**: phones show the library _or_ the open query; `lg` shows both. The library is a searchable folder tree of 44px rows; each row is one button, with an icon for the query type (flat, tree, direct links). Search results show each query's path. **Opening a query runs it**; results are tree rows, WIQL sits behind "Show WIQL", and Refresh re-runs.
- **Settings**: grouped sections (a small uppercase heading above one card). Theme is a one-row segmented radio group. In the connection form: the token field's show, copy, and clear actions sit inside the field (copy and clear only appear once there's a token), Test Connection and Save share one row, and Reset is a quiet destructive button below them. Its footer is sticky only in first-run setup, where there's no bottom nav.
- **Help**: a smaller logo on phones; sticky, horizontally scrolling pill tabs with an edge fade; headings use `scroll-mt-20` so the tabs never cover them.

## Redesign Roadmap

One PR per slice, ordered by phone impact (see AGENTS.md › Mobile-first). Tick each when it merges to `main`.

- [x] 1. Work Items tree-table and rows (#16, #17)
- [x] 2. Work Items phone header and filters: one-row search, filter chip bar, a proper `Sheet` bottom sheet, ADO-style quick views (Assigned to me / Following / Recently updated)
- [x] 3. Work item detail sheet: quick updates (one-tap state, remaining-hours stepper) above the full form
- [x] 4. App-wide shell: adopt the Ledger dark ground, phone app bar and bottom nav, page `<h1>`, motion tokens
- [x] 5. Dashboard: daily start screen with validated charts (#25, #26)
- [x] 6. Queries, Settings, Help; empty, loading, and error states (#28)

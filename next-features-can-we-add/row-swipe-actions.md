# Swipe actions on work item rows

Size: M · Impact: medium

## Problem

Common updates (move to the next state, log an hour) still need opening the detail sheet. On a phone, a swipe on the row is the natural shortcut.

## Who it helps

Phone users working through their task list, mainly in Work Items (the flagship screen).

## Rough scope

- Swipe right: move to the next state in the type's workflow (for example To Do → In Progress → Done), with an undo toast.
- Swipe left: reveal "Log time" and "Comment" buttons that open a small sheet focused on that one action.
- Every swipe action must also be available without swiping (a row menu button and keyboard), so it stays accessible and works on desktop.
- Respect `prefers-reduced-motion`, and don't conflict with the tree's expand/collapse or vertical scrolling.

## ADO APIs

Existing `updateWorkItem` and `listWorkItemTypeStates`.

## Open questions

- Which state is "next" for custom workflows such as "Ready for UAT"? Use the state category order, or let the person pick their "next" state per work item type?

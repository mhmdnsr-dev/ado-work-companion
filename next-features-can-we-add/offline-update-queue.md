# Offline update queue

Size: L · Impact: high

## Problem

The PWA only caches an offline shell. On a train or in a basement, a person can't change a state, log hours, or write a comment, and any edit they try is lost.

## Who it helps

Phone users of the installed PWA with patchy connectivity.

## Rough scope

- Persist the TanStack Query cache (IndexedDB) so the last-seen work items, sprint, and details open offline in read-only mode, with a clear "offline · last updated 10:42" banner.
- Queue mutations (state, remaining or completed hours, comments) while offline and replay them in order when back online, using background sync where the browser supports it.
- Detect conflicts with the work item `rev`: if the item changed on the server, show the person what changed and let them re-apply or drop their edit, never overwrite silently.
- Show queued edits as "pending" on the row and in the detail sheet.

## ADO APIs

Existing `updateWorkItem` (with a `test /rev` op for conflict checks) and `addWorkItemComment`.

## Open questions

- Attachments are large; do we queue them or block them offline?
- The queue must never contain the PAT; it only holds the request bodies, and the proxy adds auth on replay. Confirm this holds for background sync.

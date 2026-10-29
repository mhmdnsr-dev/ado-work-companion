# Standup summary

Size: M · Impact: medium

## Problem

Before the daily standup, people piece together what they did yesterday from memory or the Boards history.

## Who it helps

Anyone who attends a daily standup.

## Rough scope

- A "Standup" card or sheet that lists, for the previous working day: items I moved state on, hours I logged, comments I wrote, and items newly assigned to me.
- "Today" shows my in-progress items and anything blocked; "Blockers" lists items tagged or set as blocked.
- A "Copy" button that produces plain text ready to paste into Teams or Slack.
- Skips weekends, so Monday shows Friday.

## ADO APIs

`queryByWiql` (`ChangedBy = @Me AND ChangedDate >= @Today - 1`), `listWorkItemRevisions`, `listWorkItemComments` (all existing).

## Open questions

- Which field or tag means "blocked" varies by team. Make it a setting?
- Could share the revision-reading logic with the Today timesheet; build that first.

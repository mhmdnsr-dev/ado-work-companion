# Today timesheet

Size: M · Impact: high

## Problem

Logging hours is the most frequent daily task, but today it happens one work item at a time in the detail sheet. There is no answer to "how many hours have I logged today?" and no quick way to split a day across several tasks.

## Who it helps

Anyone who logs Completed Work daily against sprint tasks (developers, QA), especially at the end of the day on their phone.

## Rough scope

- A "Today" view (dashboard card plus a full sheet) showing the hours logged today per task and the day's total against a daily target (for example 8h, set in Settings).
- One screen to log hours on several tasks at once: pick tasks from "Assigned to me" in the current sprint, enter hours for each, and save them together.
- Work out today's logged hours from work item revisions (the change in `CompletedWork` with a `ChangedDate` of today, by me), so nothing extra is stored.
- Phone first: a list of tasks with a hours stepper on each row, and a sticky footer showing the total and the save button.

## ADO APIs

`listWorkItemRevisions`, `updateWorkItem` (existing), `getIterationWorkItems` (existing).

## Open questions

- Reading revisions for every task costs one request per task. Should we cap it to the current sprint, or use Analytics (`queryAnalytics`) instead?
- What should happen when a batch save partly fails: retry only the failed items?

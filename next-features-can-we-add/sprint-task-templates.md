# Sprint task templates

Size: M · Impact: medium

## Problem

At the start of each sprint, people create the same tasks again (ceremonies, code review, support, idle time) under their stories, one by one.

## Who it helps

Anyone who creates recurring tasks every sprint.

## Rough scope

- Save a template: a list of task titles with original estimates and activity, optionally with a parent story pattern.
- "Create sprint tasks" applies a template to the current iteration in one go, assigned to me, with a preview before creating.
- Optionally fill to a total-hours target (for example 60h), spreading the remainder over chosen tasks.
- Templates stay in `localStorage` (no secrets), with export/import as JSON.

## ADO APIs

Existing `createWorkItem` (with a parent relation), `listTeamIterations`, `listWorkItemTypes`.

## Open questions

- Should templates live in ADO instead (for example a work item or wiki page) so they sync across devices?

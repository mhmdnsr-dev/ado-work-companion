# Sprint capacity

Size: M · Impact: medium

## Problem

The dashboard shows burndown and state, but not whether my remaining hours fit in the days left. People find out they're over capacity at the end of the sprint.

## Who it helps

Developers planning their own sprint, and leads checking the team.

## Rough scope

- Read the team's capacity per person (hours per day, days off) for the current iteration.
- Show "My capacity": remaining hours on my tasks against my available hours left in the sprint, with a simple over/under meter.
- A team view at `md` and up (a table of people, capacity, assigned remaining); on phones, a list of people with one meter each.
- Follow the `dataviz` skill for the meter, consistent with the dashboard charts.

## ADO APIs

New: Work `capacities` and `teamdaysoff` for the iteration (`/{project}/{team}/_apis/work/teamsettings/iterations/{iterationId}/capacities`). Existing: `listTeamIterations`, `getIterationWorkItems`.

## Open questions

- Many teams never fill in capacity. What's the fallback: a default hours-per-day setting?

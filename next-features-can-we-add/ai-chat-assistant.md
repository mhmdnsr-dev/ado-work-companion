# AI chat assistant

Size: L · Impact: high · Priority: top

## Problem

Getting answers out of ADO on a phone means knowing where to tap or how to write WIQL: "what's left for me this sprint?", "which of my bugs are Ready for UAT?", "log 2h on the login task and move it to Done". A chat assistant answers in plain language and does the small updates for you.

## Who it helps

Everyone, and especially people who don't know WIQL or the Boards UI well (PMs, QA, new team members).

## Rough scope

- A chat sheet opened from the app bar or a floating action, with suggested prompts ("My sprint", "What changed since yesterday?", "Standup summary").
- The assistant uses tools that wrap the existing `@core/api` and `@core/domain` functions: search work items (via the WIQL builders), get a work item with its comments, sprint summary and burndown, list my activity.
- Write actions (change state, set remaining or completed hours, add a comment, create a task) always show a confirmation card with the exact change, and only run after the person taps Confirm.
- Answers link to work items (`#1234`) that open the detail sheet.
- Phone first: a full-height sheet, input above the keyboard, safe areas, and voice input via the OS keyboard.

## How it works

- A new server route (`/api/chat`) calls an LLM (Claude API with tool use) and runs tools on the server with the PAT from the encrypted cookie, the same way the `/api/ado` proxy does.
- The PAT is never sent to the model, never put in a prompt or tool result, and never logged.
- Only the data a tool returns is sent to the model, and only for the current question.
- The native app reuses the same `/api/chat` endpoint.

## Open questions

- Data policy: work item titles, descriptions and comments go to the LLM provider. Many organisations need approval for this, so make the assistant opt-in per device with a clear notice in Settings.
- Who pays for API usage, and with which key? Options: one server key (needs rate limits per user) or each person brings their own key.
- Which model, chosen by testing speed and cost on realistic prompts during the slice.
- Do we keep chat history? Recommended for v1: no, history lives only in the open session.

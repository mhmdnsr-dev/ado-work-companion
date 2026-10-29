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

- A new server route (`/api/chat`) calls an LLM (Claude API with tool use) using the person's own API key, and runs tools on the server with the PAT, both read from encrypted cookies the same way the `/api/ado` proxy reads the PAT.
- Neither the PAT nor the API key is ever sent to the model, put in a prompt or tool result, or logged.
- Only the data a tool returns is sent to the model, and only for the current question.
- The native app reuses the same `/api/chat` endpoint.

## Decisions (2026-10-29)

- **Opt-in per device.** The assistant is off by default. Settings shows a clear notice that work item titles, descriptions and comments are sent to the LLM provider, and the person turns it on for that device only. Nothing is sent before they opt in.
- **Each person brings their own API key.** No shared server key, so no central billing or per-user rate limits.
  - Web: the key is entered in Settings, POSTed once to the server, and stored in an encrypted HttpOnly cookie, exactly like the PAT. `/api/chat` reads it from the cookie on each request.
  - Native: the key goes in Expo SecureStore through the storage port.
  - The key is never readable by page JavaScript, never logged, never sent anywhere except the LLM provider, and can be removed from Settings. Opting out also deletes it.
  - Settings shows a "Test key" button and a link explaining how to create a key and set a spending limit with the provider.

## Open questions

- Which model, chosen by testing speed and cost on realistic prompts during the slice. Since people pay for their own usage, consider letting them pick between a faster, cheaper model and a stronger one.
- Do we keep chat history? Recommended for v1: no, history lives only in the open session.

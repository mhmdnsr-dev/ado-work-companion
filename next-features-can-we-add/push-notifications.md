# Push notifications

Size: L · Impact: medium

## Problem

People miss @mentions and new assignments because they don't keep Boards open or read ADO emails on their phone.

## Who it helps

Anyone using the installed PWA who wants a nudge when someone needs them.

## Rough scope

- Web Push notifications for: I'm @mentioned, a work item is assigned to me, a comment is added on an item I follow.
- Tapping a notification opens the work item's detail sheet.
- Per-type on/off switches in Settings, plus quiet hours.

## ADO APIs

ADO Service Hooks subscriptions pointing at a new webhook route on our server, which sends Web Push (VAPID) to the person's subscribed devices.

## Open questions

- This needs server-side state (push subscriptions and their link to an ADO identity), which the app doesn't have today. Pick a store before starting.
- Creating service hook subscriptions needs project admin rights. Fallback: poll the "Mentioned" and "Assigned to me" quick views periodically while the app is open.

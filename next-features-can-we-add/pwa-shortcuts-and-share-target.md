# PWA shortcuts and share target

Size: S · Impact: medium

## Problem

`public/manifest.json` has no `shortcuts` and no `share_target`. Getting to "log hours" or "my work" takes several taps, and attaching a phone screenshot to a bug means opening the app, finding the item, and picking the file again.

## Who it helps

Everyone who installs the app on their phone, and QA people who capture screenshots on device.

## Rough scope

- App icon shortcuts (long-press on Android): "My work items", "Log hours", "New work item", "Dashboard".
- A Web Share Target so "Share → ADO Work Companion" from the gallery or another app opens a picker: search or pick a recent work item, then upload the shared images or files as attachments (and optionally add the shared text as a comment).
- Handle the share POST in the service worker or a route, keeping files in memory only until upload.

## ADO APIs

Existing `uploadAttachment` and `attachFileToWorkItem`.

## Open questions

- Share target needs a POST handler that works with `@ducanh2912/next-pwa`; check whether a custom worker is needed.
- iOS doesn't support Web Share Target; shortcuts still work there only partly. Is Android-first acceptable?

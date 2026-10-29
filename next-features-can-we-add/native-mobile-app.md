# Native mobile app

Size: XL · Impact: high · Priority: top

## Problem

Most people use the app on their phone as an installed PWA, and the PWA hits platform limits: no Web Share Target or reliable Web Push on iOS, no home-screen widgets, no biometric unlock, and limited background work for offline sync. It also isn't in the App Store or Play Store, so people don't find it.

## Who it helps

Every phone user, iOS users most of all.

## Rough scope

- An Expo (React Native) app that reuses `src/core` as is: `api/` (transport and resources), `domain/` (WIQL, hierarchy, filters, burndown), `schemas/`, and `types/`. This is what the "framework-free, no React or Next" rule in AGENTS.md was for.
- Move to npm workspaces: `apps/web` (this Next.js app), `apps/mobile` (Expo), `packages/core` (today's `src/core`, imported as `@core/...` from both).
- Auth: the PAT goes in Expo SecureStore through the existing storage port (`src/core/ports/storage.ts`), and the app calls ADO directly (native fetch has no CORS, so no proxy is needed). Later: Microsoft Entra ID sign-in so people don't need a PAT at all.
- First release matches the flagship flows: Work Items (tree, filters, quick views), detail sheet with quick updates, comments, attachments (camera and gallery), Dashboard.
- Native extras after that: biometric unlock, a home-screen widget ("logged today 5.5h / 8h"), share extension to attach files to a work item, push notifications, offline storage in SQLite.
- Design: carry the DESIGN.md tokens (oklch colours, type scale, motion) into a shared token file both apps read, so web and native look like one product.

## ADO APIs

No new ones for the first release; everything goes through `@core/api`.

## Decisions (2026-10-29)

- **Internal testing only, no public store listing.** iOS through TestFlight, Android through Google Play internal testing, with builds made by Expo EAS. This avoids public store review and store listing pages, but still needs an Apple Developer account and a Google Play Console account. Limits to plan for:
  - TestFlight internal testers must be users on the App Store Connect team (up to 100) and skip review; testers outside the team need a Beta App Review.
  - TestFlight builds expire after 90 days, so plan a regular rebuild.
  - Play internal testing allows up to 100 testers, added by email.
- **The AI assistant follows its own decisions** (see [ai-chat-assistant.md](ai-chat-assistant.md)): opt-in per device, and the person's own API key stored in SecureStore.

## Open questions

- Styling on native: NativeWind (Tailwind classes, closest to the web code) or a small token-based StyleSheet layer?
- Do we keep the PWA as the desktop and "try it first" version once native ships? (Recommended: yes.)
- Push notifications still need a server that receives ADO service hooks (see [push-notifications.md](push-notifications.md)); native only replaces the Web Push delivery part.

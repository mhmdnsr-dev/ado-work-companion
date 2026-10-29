# Next features we can add

Ideas for features after the redesign roadmap in `DESIGN.md`. Use one file per idea (`<idea-name>.md`) with a short note on the problem, who it helps, and a rough scope.

When an idea is picked up, start a `feat/<name>` branch and move the working notes to `.agents/features/<name>.md`.

## Top priority

| Idea                                      | Size | Impact | Summary                                                                                  |
| ----------------------------------------- | ---- | ------ | ---------------------------------------------------------------------------------------- |
| [Native mobile app](native-mobile-app.md) | XL   | high   | Expo app reusing `src/core`, with SecureStore auth, widgets, share extension, biometrics |
| [AI chat assistant](ai-chat-assistant.md) | L    | high   | Ask about your work in plain language; confirmed tool calls for updates                  |

## More ideas

| Idea                                                                | Size | Impact | Summary                                                                 |
| ------------------------------------------------------------------- | ---- | ------ | ----------------------------------------------------------------------- |
| [Today timesheet](today-timesheet.md)                               | M    | high   | Hours logged today across tasks, and log hours on several tasks at once |
| [Offline update queue](offline-update-queue.md)                     | L    | high   | Read cached items offline and queue edits until back online             |
| [PWA shortcuts and share target](pwa-shortcuts-and-share-target.md) | S    | medium | Home-screen shortcuts, and share phone screenshots straight to an item  |
| [Swipe actions on rows](row-swipe-actions.md)                       | M    | medium | Swipe to move state or log time without opening the detail sheet        |
| [Standup summary](standup-summary.md)                               | M    | medium | Yesterday/today summary from my activity, ready to paste                |
| [Sprint capacity](sprint-capacity.md)                               | M    | medium | My remaining hours against my capacity for the rest of the sprint       |
| [Sprint task templates](sprint-task-templates.md)                   | M    | medium | Create my recurring sprint tasks from a saved template                  |
| [Push notifications](push-notifications.md)                         | L    | medium | Notify on @mentions, assignments, and comments on followed items        |

Suggested order: the two top-priority items first. The AI assistant can ship on the web app first, and the native app reuses its `/api/chat` endpoint. Native also covers parts of the PWA shortcuts and push notification ideas on iOS. After that: Today timesheet, then Standup summary (reuses the timesheet's revision logic).

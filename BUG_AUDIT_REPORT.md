# QA Audit Report — Last-Minute Life Saver

Date: 2026-07-01
Scope: Full application audit, no code changes made.

## Verification Summary
- `npm run build` passed.
- TypeScript check (`./node_modules/.bin/tsc --noEmit`) passed.
- No repository test files were present, so there were no existing automated tests to run.
- Browser and server logs confirmed the app boots, serves the SPA, and exercises the main auth/dashboard flows.

## Critical

### B-02 — Profile update allows mass assignment
- **Description:** The authenticated profile update endpoint merges the entire request body into the persisted user record, so a client can overwrite protected fields such as `role`, `id`, `password`, or `refreshTokens`.
- **How to reproduce:** Send `PUT /api/auth/me` with a valid bearer token and a body like `{ "role": "admin", "refreshTokens": [], "id": "other-user" }`.
- **Affected files:** [server.ts](server.ts#L560-L575)
- **Root cause:** `req.body` is spread directly into `db.users[userIdx]` without a whitelist or field-level validation.
- **Priority:** Critical
- **Estimated fix:** M (backend validation + DTO sanitization)

## High

### B-01 — Google Calendar linking flow is broken end-to-end
- **Description:** The calendar-link button opens a backend URL that does not exist, and the app also uses `noopener,noreferrer`, preventing the popup from notifying the opener even if a link flow succeeded.
- **How to reproduce:** Open Settings, click “Link Google Calendar,” and observe the popup/redirect never completes a usable link state in the main app.
- **Affected files:** [src/screens/SettingsScreen.tsx](src/screens/SettingsScreen.tsx#L103-L111), [src/App.tsx](src/App.tsx#L198-L211), [server.ts](server.ts)
- **Root cause:** No `/api/calendar/google/link` handler exists in the backend, and the popup pattern prevents `postMessage`-style handoff to the parent window.
- **Priority:** High
- **Estimated fix:** M (implement route + popup callback wiring)

### B-03 — Auth responses leak sensitive user fields
- **Description:** Login and profile endpoints return the full `User` object, including the bcrypt password hash and refresh token array.
- **How to reproduce:** Log in or call `GET /api/auth/me` and inspect the JSON payload.
- **Affected files:** [server.ts](server.ts#L383-L481), [server.ts](server.ts#L542-L560)
- **Root cause:** The server returns raw user records instead of a sanitized auth/profile DTO.
- **Priority:** High
- **Estimated fix:** S (return a safe view model and strip secrets)

### B-04 — Notification read endpoint is not ownership-scoped
- **Description:** Any authenticated user can mark any notification as read if they know or guess the notification ID.
- **How to reproduce:** Call `PUT /api/notifications/:id/read` with a notification ID that belongs to another user.
- **Affected files:** [server.ts](server.ts#L949-L962)
- **Root cause:** The endpoint looks up notifications by ID only and never checks `userId` ownership before updating.
- **Priority:** High
- **Estimated fix:** S (verify `userId` before mutation)

## Medium

### B-05 — Desktop notification permission state is not synchronized across screens
- **Description:** Enabling browser notifications from Settings does not reliably update the main app’s live notification state until the session is refreshed.
- **How to reproduce:** Open Settings, click “Enable browser notifications,” stay in the same session, then wait for a notification event; the main app may not show native toasts until reload.
- **Affected files:** [src/screens/SettingsScreen.tsx](src/screens/SettingsScreen.tsx#L83-L111), [src/App.tsx](src/App.tsx#L70-L139)
- **Root cause:** Settings updates browser permission locally, but the live app notification flag is maintained separately and is only re-evaluated in App effects.
- **Priority:** Medium
- **Estimated fix:** S (lift permission state or dispatch a shared update event)

### B-06 — Rescue My Day ignores selected task inputs
- **Description:** The rescue modal collects selected tasks, meetings, deadlines, and available hours, but the backend rescue computation still uses all of the user’s pending tasks and calendar events.
- **How to reproduce:** Open the rescue modal, select only a subset of tasks, enter custom meetings/deadlines, and generate a plan; the output still reflects the full workload set.
- **Affected files:** [src/App.tsx](src/App.tsx#L162-L188), [server.ts](server.ts#L1436-L1475)
- **Root cause:** The API stores the submitted fields in the saved recovery plan, but the actual computation call uses the full task/calendar datasets instead of the user-selected subset.
- **Priority:** Medium
- **Estimated fix:** M (plumb selected inputs into the rescue calculation)

### B-07 — Subtask toggle can throw when local cache is missing
- **Description:** Toggling a subtask assumes the parent task already has a populated local subtask array and can crash if that cache entry is absent.
- **How to reproduce:** Open a task and toggle a subtask before the async subtask fetch finishes, or after a failed subtask load.
- **Affected files:** [src/screens/TasksScreen.tsx](src/screens/TasksScreen.tsx#L169-L175), [src/screens/TasksScreen.tsx](src/screens/TasksScreen.tsx#L50)
- **Root cause:** The update path calls `prev[sub.taskId].map(...)` without a fallback when `prev[sub.taskId]` is undefined.
- **Priority:** Medium
- **Estimated fix:** S (add a safe default array before mapping)

## Low

- No additional low-severity bugs were confirmed in this audit pass.

## Notes
- The app is large and feature-rich; the findings above are the concrete issues verified from code and runtime behavior during this QA pass.
- Existing automated tests were not present in the repository, so this audit relied on lint/build validation, runtime logs, and source inspection.
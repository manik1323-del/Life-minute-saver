# RELEASE_BLOCKER_REPORT — Last-Minute Life Saver

Date: 2026-07-01
Scope: Full application QA audit. No code changes were made during this audit.

Overview: This report converts the prior QA audit findings into a release-blocker oriented checklist. Each issue includes a full description, repro steps, impact, suggested remediation, and classification tags.

SUMMARY METRICS
- Release readiness score (0–100): 58
- Estimated number of confirmed bugs: 7
- Estimated time to fix (engineering effort): ~7 working days (approx. 56 hours)
- Recommended fix order: BLOCKER → CRITICAL → HIGH → MEDIUM → LOW

ISSUES

1) Bug ID: B-02
- Title: Profile update allows mass assignment (user record overwrite)
- Severity: BLOCKER
- Classification: Authentication, Authorization, Security, Backend, API
- Affected files: server.ts [PUT /api/auth/me] (server.ts#L560-L575)
- Root cause: The update handler spreads `req.body` directly onto persisted user objects without filtering or a field whitelist, allowing clients to overwrite protected fields (role, id, password, refreshTokens, organizationIds, etc.).
- Steps to reproduce:
  1. Authenticate as a normal user and obtain bearer token.
 2. Send `PUT /api/auth/me` with JSON body like `{ "role": "admin", "refreshTokens": [], "id": "u-1234" }` and Authorization header `Bearer <token>`.
 3. Inspect returned user object or subsequent `GET /api/auth/me` to confirm fields were changed.
- Expected behavior: Only allowed profile fields (display name, theme, work hours, focusPeriod, non-sensitive preferences) should be updatable. Sensitive fields (`role`, `id`, `password`, `refreshTokens`) must be ignored or rejected.
- Current behavior: The server persists the entire `req.body` over existing user data and returns the merged object.
- Suggested fix: Implement a server-side DTO/whitelist for profile updates; explicitly pick permitted fields to merge (e.g., name, theme, workHoursStart, workHoursEnd, focusPeriod). Reject or ignore unknown/sensitive fields. Add test coverage.
- Risk if left unresolved: Privilege escalation, account takeover scenarios, data loss, complete compromise of multi-tenant boundaries. High legal/operational exposure.
- Dependencies: server DB model, auth middleware, user persistence logic.
- Estimated implementation effort: Medium — 1–2 developer days plus tests (8–16 hours).

2) Bug ID: B-03
- Title: Auth endpoints return sensitive user data (password hash, refreshTokens)
- Severity: BLOCKER
- Classification: Security, Backend, Authentication
- Affected files: server.ts [POST /api/auth/login] (server.ts#L383-L481), server.ts [GET /api/auth/me] (server.ts#L530-L560)
- Root cause: The server returns raw user objects (including `password`, `refreshTokens`, etc.) in auth responses rather than a sanitized DTO.
- Steps to reproduce:
  1. Call `POST /api/auth/login` with credentials or `GET /api/auth/me` with a valid token.
  2. Inspect the JSON response and observe `password` (bcrypt hash) and `refreshTokens` fields included.
- Expected behavior: Responses should return a safe user view (id, email, name, public preferences) and must not expose password hashes, refresh tokens, or internal tokens arrays.
- Current behavior: Full internal user objects are returned.
- Suggested fix: Create view model for user responses (strip `password`, `refreshTokens`, internal flags). Ensure login returns only `token`, `refreshToken`, and a sanitized `user` object. Add unit tests to assert no secrets are serialized.
- Risk if left unresolved: Immediate credential leakage risk; refresh token disclosure may allow session hijacking. Critical security breach.
- Dependencies: auth controller, token issuance, DB write flow.
- Estimated implementation effort: Small — 4–8 hours including tests.

3) Bug ID: B-04
- Title: Notification read endpoint is not ownership-scoped
- Severity: CRITICAL
- Classification: Backend, Security, Notifications
- Affected files: server.ts [PUT /api/notifications/:id/read] (server.ts#L949-L962)
- Root cause: The route locates notifications by ID only and marks them read without verifying notification.userId matches the authenticated user.
- Steps to reproduce:
  1. Authenticate as user A and get bearer token.
  2. Issue `PUT /api/notifications/<notification-id-of-user-B>/read` with Authorization `Bearer <userA-token>`.
  3. Observe the notification record is updated (no ownership check).
- Expected behavior: Only the owner of a notification may mark it read. The endpoint must validate `notification.userId === currentUserId` before mutating.
- Current behavior: Any authenticated user (who can guess an ID) can mark arbitrary notifications read.
- Suggested fix: Add ownership verification using `getAuthorizedUserId(req)` and return 403 if the user does not own the notification. Add tests for unauthorized access.
- Risk if left unresolved: Users can alter other users' notification states; low direct data leak but allows tampering and information inference; could be used in orchestrated attacks.
- Dependencies: Notification model, auth middleware.
- Estimated implementation effort: Small — 2–4 hours.

4) Bug ID: B-01
- Title: Google Calendar linking flow broken / popup handoff prevents completion
- Severity: HIGH
- Classification: Calendar, Frontend, Backend, UI/UX
- Affected files: src/screens/SettingsScreen.tsx (link button) (src/screens/SettingsScreen.tsx#L103-L111), src/App.tsx (message listener) (src/App.tsx#L198-L211), server.ts (no route implemented)
- Root cause: Frontend opens `/api/calendar/google/link` in a popup with `noopener,noreferrer`, which blocks `window.opener` messaging; additionally, the backend route `/api/calendar/google/link` is not implemented to complete an OAuth handshake and postMessage back.
- Steps to reproduce:
  1. Open Settings in the running app.
  2. Click `Link Google Calendar` button.
  3. Popup either fails to load a linking flow or, if flow were present, cannot notify the parent due to `noopener,noreferrer`.
- Expected behavior: Popup completes OAuth handshake and notifies the parent window via `postMessage({ type: 'GOOGLE_CALENDAR_LINKED', success: true })`, or the parent polls/refreshes after a redirect; the main UI then reflects calendar linkage without a full reload.
- Current behavior: Popup opens but no meaningful link completes; clicking does not set calendar-linked state in the main app.
- Suggested fix: Implement backend OAuth handshake endpoints for Google Calendar linking, remove `noopener,noreferrer` or add a redirect endpoint that uses `postMessage` to notify the parent, and add server-side persistence of the link state. Ensure CSRF and origin checks for `postMessage`.
- Risk if left unresolved: Calendar integration unusable; feature regression for users relying on meeting sync. UX regression but not immediate data exposure.
- Dependencies: Google OAuth credentials, server calendar endpoints, frontend postMessage wiring.
- Estimated implementation effort: Medium — 1–2 developer days (8–16 hours), plus testing with Google API credentials.

5) Bug ID: B-06
- Title: Rescue My Day computation ignores user-submitted subset inputs
- Severity: MEDIUM
- Classification: AI Engine, Backend, Scheduler, UI/UX
- Affected files: server.ts [POST /api/ai/rescue] (server.ts#L1436-L1475), src/App.tsx (rescue modal plumbing) (src/App.tsx#L162-L188)
- Root cause: The rescue endpoint persists the incoming payload into the saved recovery plan but calls the rescue routine using the full task and calendar sets (db.tasks, calendarEvents) rather than the user-specified `pendingTasks`, `deadlines`, `meetings` arrays.
- Steps to reproduce:
  1. Open the rescue modal, select a subset of tasks and enter custom `availableHours` and `meetings`.
  2. Submit the rescue request and inspect the returned plan/schedule.
  3. Observe the plan contains tasks/events outside the selected subset.
- Expected behavior: The rescue algorithm should respect the selected `pendingTasks`, `deadlines`, and `meetings` arrays sent in the request body, producing a plan specifically for the chosen inputs.
- Current behavior: The returned rescue plan is computed using all pending tasks and calendar events for the user, ignoring the selection.
- Suggested fix: Pass the submitted `pendingTasks`, `deadlines`, and `meetings` arrays through to `runEmergencyRescue` (or filter the inputs before calling the engine). Add unit tests to assert the engine respects explicit inputs.
- Risk if left unresolved: Misleading AI outputs; user trust erosion and bad scheduling decisions.
- Dependencies: AI rescue routine, request validation.
- Estimated implementation effort: Medium — 1–2 days (8–16 hours).

6) Bug ID: B-07
- Title: Subtask toggle can throw when local subtask cache missing
- Severity: MEDIUM
- Classification: Frontend, UI/UX, Code Quality
- Affected files: src/screens/TasksScreen.tsx (toggleSubtask state update) (src/screens/TasksScreen.tsx#L169-L175)
- Root cause: The `toggleSubtask` handler updates local `subtasks` state via `prev[sub.taskId].map(...)` assuming the array exists; if `prev[sub.taskId]` is undefined (not yet loaded), this causes a runtime error.
- Steps to reproduce:
  1. Navigate to a task list that lazily fetches subtasks.
  2. Expand a task and immediately click a subtask checkbox before the async `getSubtasks` resolves.
  3. Observe an uncaught TypeError in the browser console.
- Expected behavior: Toggling a subtask should be resilient; if local cache missing, either optimistically update via a safe default array or await fetch completion and disable controls until data is present.
- Current behavior: Handler can throw due to missing array.
- Suggested fix: Guard the state update with `prev[sub.taskId] || []`, or ensure subtasks are initialized to `[]` for tasks on load. Add UI disabled states while loading.
- Risk if left unresolved: Client-side crash and degraded UX; users may be unable to interact with subtasks in some timing conditions.
- Dependencies: Frontend state initialization and API call timing.
- Estimated implementation effort: Small — 2–4 hours.

7) Bug ID: B-05
- Title: Desktop notification enablement not synchronized across app state
- Severity: LOW
- Classification: Frontend, Notifications, UI/UX
- Affected files: src/screens/SettingsScreen.tsx (requestBrowserNotifications) (src/screens/SettingsScreen.tsx#L83-L111), src/App.tsx (desktopNotificationsEnabled state) (src/App.tsx#L70-L139)
- Root cause: Settings requests browser permission locally and shows a notification locally, but does not update the shared application-level `desktopNotificationsEnabled` flag or broadcast a state change to other components; App only re-evaluates permission on mount/user refresh.
- Steps to reproduce:
  1. From Settings, click `Enable browser notifications` and accept permission.
  2. Remain on the app and wait for a `notification:created` socket event.
  3. Observe that native desktop toast may not appear until reload.
- Expected behavior: Settings toggle should update shared state (e.g., via `useAuth` context or an event) so the main app immediately shows native toasts for incoming notifications.
- Current behavior: Main app may not show native toasts until re-evaluation / reload.
- Suggested fix: After requesting permission in Settings, dispatch a global event or call the app-level setter (via context) to update `desktopNotificationsEnabled`. Alternatively, the settings action can trigger `window.dispatchEvent(new CustomEvent('desktop-notifications-changed', { detail: permission }))` and App listens for it.
- Risk if left unresolved: UX confusion, missed timely alerts; lower severity than security issues.
- Dependencies: App context wiring for notifications.
- Estimated implementation effort: Small — 2–4 hours.


RELEASE READINESS, PRIORITIZATION, AND TIMELINE

- Release readiness score rationale: Several critical security issues (mass-assignment, secret leaks) exist. While the app builds and typechecks, security and auth flaws dramatically reduce readiness. Hence score: 58/100.
- Estimated number of bugs: 7 confirmed (listed above). Additional issues may exist under deeper integrations (Google API credentials, socket edge cases) but were not confirmed in this pass.
- Estimated time to fix (aggregate): ~7 working days (~56 hours). Breakdown:
  - B-02 (mass assignment): 8–16 hours
  - B-03 (auth secret leak): 4–8 hours
  - B-04 (notification ownership): 2–4 hours
  - B-01 (calendar linking): 8–16 hours
  - B-06 (rescue input plumbing): 8–16 hours
  - B-07 (subtask toggle guard): 2–4 hours
  - B-05 (notification sync): 2–4 hours

- Recommended fix order (minimum viable safety-first):
  1. B-02 (mass assignment) — BLOCKER
  2. B-03 (auth secrets leak) — BLOCKER
  3. B-04 (notification ownership) — CRITICAL
  4. B-01 (calendar linking) — HIGH
  5. B-06 (rescue behavior) — MEDIUM
  6. B-07 (subtask toggle) — MEDIUM
  7. B-05 (notification sync) — LOW/MEDIUM

Notes & next steps:
- Do NOT patch in this branch — the release blocker report is for triage and planning only.
- After triage, I recommend opening prioritized tickets with linked code references and small PRs per fix to keep changes reviewable and testable.
- I can convert each item into a ready-to-assign GitHub issue with required acceptance criteria and test cases if you want.

End of report.

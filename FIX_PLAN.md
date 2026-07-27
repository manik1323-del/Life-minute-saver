# FIX_PLAN — Implementation Roadmap

This document groups fixes into phases and provides a step-by-step plan for each bug.

PHASE 1 — Release Blockers

B-02 — Profile update allows mass assignment
- Root Cause: `req.body` is merged directly into `db.users[userIdx]` without a whitelist.
- Implementation Steps:
  1. Create a `sanitizeUserUpdate()` helper that whitelists allowed profile fields (name, theme, workHoursStart, workHoursEnd, focusPeriod, other non-sensitive prefs).
  2. Replace merge logic in `PUT /api/auth/me` with sanitized payload.
  3. Add unit tests for profile update rejecting sensitive fields.
  4. Add integration test confirming role/id/password/refreshTokens cannot be modified.
- Expected Result: Only permitted fields are updated; sensitive fields remain unchanged.
- Files to Modify: `server.ts`, create helper in `server/` (e.g., `server/lib/sanitizers.ts`) if appropriate.
- Estimated Effort: 8–16 hours

B-03 — Auth endpoints return sensitive user data
- Root Cause: Full user objects including `password` and `refreshTokens` are returned.
- Implementation Steps:
  1. Create `toPublicUser(user)` view model that strips `password`, `refreshTokens`, and other internal fields.
  2. Update `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh` to return sanitized user.
  3. Add tests asserting secrets are not present in responses.
- Expected Result: Auth endpoints return safe user DTOs.
- Files to Modify: `server.ts`, tests.
- Estimated Effort: 4–8 hours

PHASE 2 — Critical

B-04 — Notification read endpoint not ownership-scoped
- Root Cause: Notification mutation lacks ownership check.
- Implementation Steps:
  1. In `PUT /api/notifications/:id/read`, check `note.userId === currentUserId` before updating.
  2. Return 403 for unauthorized attempts.
  3. Add tests for ownership violations.
- Expected Result: Only owners can mutate their notifications.
- Files to Modify: `server.ts`
- Estimated Effort: 2–4 hours

PHASE 3 — High

B-01 — Google Calendar linking flow broken
- Root Cause: No backend OAuth route and popup uses `noopener,noreferrer` preventing handoff.
- Implementation Steps:
  1. Implement OAuth endpoints: `/api/calendar/google/link` (initiates OAuth), `/api/calendar/google/callback` (handles callback, stores link state).
  2. Implement server-side persistence of calendar link in user record (e.g., `googleCalendarLinked`, tokens stored securely if needed).
  3. Modify popup logic to allow postMessage (remove `noopener,noreferrer`) or provide a redirect page that calls `postMessage` to opener.
  4. Add CSRF/origin checks in `postMessage` handler.
  5. Add manual integration test using Google API credentials.
- Expected Result: Users can link/unlink Google Calendar and main UI reflects linkage immediately.
- Files to Modify: `server.ts`, `src/screens/SettingsScreen.tsx`, `src/App.tsx`.
- Estimated Effort: 8–16 hours + testing with credentials

PHASE 4 — Medium

B-06 — Rescue ignores selected task inputs
- Root Cause: Rescue engine called with full datasets instead of filtered inputs.
- Implementation Steps:
  1. Update `POST /api/ai/rescue` to filter tasks/calendarEvents based on submitted `pendingTasks`/`meetings` (or pass these arrays explicitly to `runEmergencyRescue`).
  2. Add validation to ensure `availableHours` present and numeric.
  3. Add unit test ensuring selection-respected results.
- Expected Result: Rescue plan honors user-selected subset inputs.
- Files to Modify: `server.ts`, possibly `server/ai.ts`.
- Estimated Effort: 8–16 hours

B-07 — Subtask toggle can throw when cache missing
- Root Cause: Frontend state update assumes `subtasks[taskId]` exists.
- Implementation Steps:
  1. Update `toggleSubtask` to use `prev[sub.taskId] || []` when mapping.
  2. Initialize `subtasks[t.id] = []` for tasks on initial load to avoid undefined.
  3. Add UI disabled states while subtasks are loading.
  4. Add unit/interaction tests.
- Expected Result: No client-side exceptions during subtask toggles.
- Files to Modify: `src/screens/TasksScreen.tsx`.
- Estimated Effort: 2–4 hours

PHASE 5 — Low

B-05 — Desktop notification enablement not synced
- Root Cause: Settings changes do not update app-level `desktopNotificationsEnabled` flag.
- Implementation Steps:
  1. After permissions granted in `SettingsScreen`, dispatch a global event or call a context method to update `desktopNotificationsEnabled` in `App`.
  2. Ensure `App` listens for the event and updates state accordingly.
  3. Add tests and manual verification steps.
- Expected Result: Enabling notifications in Settings immediately enables desktop toasts.
- Files to Modify: `src/screens/SettingsScreen.tsx`, `src/App.tsx`, `src/contexts/AuthContext.tsx` (if preferred).
- Estimated Effort: 2–4 hours

# REGRESSION_CHECKLIST

This checklist defines the manual and automated verification steps required after each bug fix. Use this to verify regressions are not introduced.

Format per bug:
- Bug ID
- Manual verification steps
- Browser verification
- Backend/API verification
- Database verification
- Expected result

---

Bug ID: B-02 — Profile update allows mass assignment
- Manual verification:
  1. Log in as regular user.
 2. Navigate to Settings and attempt to change `role` via POST/PUT payload (use REST client).
 3. Confirm UI and `GET /api/auth/me` show no change to `role`.
- Browser verification: After saving allowed settings, verify UI reflects permitted changes (display name, theme) only.
- Backend/API verification: Run automated test that sends `PUT /api/auth/me` with sensitive fields; assert response and DB unchanged for those fields.
- Database verification: Inspect `data/db.json` to ensure `role`, `password`, `refreshTokens` unchanged.
- Expected result: Only whitelisted fields update; sensitive fields unchanged; API returns 200 with sanitized user.

---

Bug ID: B-03 — Auth endpoints return sensitive user data
- Manual verification:
  1. Login with test user and call `GET /api/auth/me`.
 2. Inspect response for absence of `password` and `refreshTokens`.
- Backend/API verification: Unit test asserting login and me endpoints return sanitized user.
- Database verification: DB still contains password and refreshTokens, but API layers never expose them.
- Expected result: No secrets in API responses.

---

Bug ID: B-04 — Notification read endpoint ownership
- Manual verification:
  1. With two users A and B, create sample notifications for B.
 2. Attempt `PUT /api/notifications/:id/read` with A's token for B's notification.
 3. Expect 403 forbidden.
- API verification: Automated test for unauthorized mutation.
- DB verification: Notification read flag remains false after unauthorized attempt.
- Expected result: Ownership enforced.

---

Bug ID: B-01 — Google Calendar linking
- Manual verification:
  1. With Google OAuth test app, click link calendar, complete OAuth, ensure parent window sees `GOOGLE_CALENDAR_LINKED` and UI updates.
 2. Unlink and re-link to confirm idempotency.
- Browser verification: Popup correctly posts message to opener, App updates state without full reload.
- Backend/API verification: OAuth callback exchanges code for tokens, persists state to user record.
- DB verification: `user.googleCalendarLinked` and any token references are stored securely.
- Expected result: Smooth link/unlink, main UI shows linked state.

---

Bug ID: B-06 — Rescue respects selection
- Manual verification:
  1. Select subset of tasks in Rescue modal and run rescue.
 2. Confirm returned plan only references selected tasks.
- API verification: POST body with `pendingTasks` used by the rescue engine.
- DB verification: Saved recovery plan includes the submitted arrays.
- Expected result: Rescue plan matches submitted inputs.

---

Bug ID: B-07 — Subtask toggle resilience
- Manual verification:
  1. Rapidly toggle subtask checkboxes while data is loading.
  2. Confirm no uncaught exceptions in console and UI updates correctly.
- Browser verification: Controls disabled while loading.
- API verification: Subtask toggles produce correct `PUT /api/subtasks/:id` calls.
- Expected result: No runtime errors.

---

Bug ID: B-05 — Notification permission sync
- Manual verification:
  1. Enable notifications in Settings, accept permission.
  2. Trigger `notification:created` and verify native toast appears without reload.
- Browser verification: App state `desktopNotificationsEnabled` true after permission acceptance.
- API verification: N/A.
- Expected result: Immediate native notifications.

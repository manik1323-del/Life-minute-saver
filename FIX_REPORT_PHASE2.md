# FIX REPORT — Phase 2 (Critical)

Summary
- Fixed critical issue B-04: Notification ownership validation. The notifications endpoint now enforces that only the owning user may mutate (mark read) their notifications.

Root cause
- The `PUT /api/notifications/:id/read` endpoint previously located notifications by ID only and unconditionally marked them as read. There was no ownership check against the authenticated user, allowing any authenticated token to modify any notification.

Files modified
- `server.ts` — Updated GET `/api/notifications` to use the existing `getAuthorizedUserId(req)` helper and to scope results to the authenticated user. Updated PUT `/api/notifications/:id/read` to return `401` when unauthenticated, `404` when notification not found, and `403` when the authenticated user does not own the notification. Writes are persisted with `writeDb(db)`.
- `scripts/run_notification_tests.js` — New test script that creates two users, injects a notification for user B into `data/db.json`, verifies that user A receives `403` when attempting to mark B's notification read, and verifies B can mark the notification as read successfully.

Tests executed
- Type check: `npm run lint` (tsc --noEmit) — passed.
- Build: `npm run build` (Vite + esbuild) — passed; `dist/server.cjs` produced.
- Notification ownership test: `node scripts/run_notification_tests.js` — results:
  - Signup A/B: 200
  - A PUT /api/notifications/:id/read: 403 Forbidden (expected) — PASSED
  - B PUT /api/notifications/:id/read: 200 OK (expected) — PASSED
  - DB shows notification marked `read: true` only after B's action — PASSED

Regression checklist (notifications)
- With two users A and B, created a notification for B and confirmed cross-user mutation is blocked — PASS.
- GET /api/notifications returns only the authenticated user's notifications — PASS (server now uses `getAuthorizedUserId`).

Verification notes
- The running dev server was restarted to pick up `server.ts` changes before running notification tests.
- All verification steps were executed locally against the development server on port 3000.

Risk & Next Steps
- Regression risk: Low — change is narrow and limited to notification-related endpoints.
- Recommended follow-ups:
  1. Add automated unit/integration tests to CI for notification ownership behavior.
 2. Add more granular audit logging for attempted unauthorized access (rate-limit alerts).

Prepared by: GitHub Copilot

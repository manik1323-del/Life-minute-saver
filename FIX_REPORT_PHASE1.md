# FIX REPORT — Phase 1 (Release Blockers)

Summary
- Fixed release-blocker issues B-02 and B-03 following the agreed FIX_PLAN.

Root cause
- B-02: Profile update endpoint accepted unchecked `req.body` and merged it into the user record (mass-assignment), allowing protected fields to be overwritten.
- B-03: Auth endpoints returned full user objects (including `password` and `refreshTokens`) to clients.

Files modified
- server.ts — added DTO mapping and sanitization helpers; updated signup/login/me/PUT handlers to use safe DTOs and whitelist updates.

What I changed
- Added `toPublicUser(user)` to strip sensitive fields (`password`, `refreshTokens`) from responses.
- Added `sanitizeProfileUpdate(data)` to whitelist allowed profile fields (name, theme, workHoursStart, workHoursEnd, focusPeriod, etc.).
- Replaced direct `...req.body` merges in PUT /api/auth/me with `sanitizeProfileUpdate(req.body)`.
- Removed refresh token exposure from JSON responses (server still stores refresh tokens for token rotation flows, but they are never returned to clients).

Tests executed (manual / local)
- Script: `node scripts/run_auth_tests.js` — created a test user and exercised flows against local server on port 3000.
- Steps executed and results:
  - POST /api/auth/signup: returned `token` and sanitized `user` (no `password` or `refreshTokens`) — PASSED
  - POST /api/auth/login: returned `token` and sanitized `user` — PASSED
  - GET /api/auth/me: returned sanitized `user` — PASSED
  - PUT /api/auth/me with payload { role: 'admin', name: 'Auto NewName' }: name updated, role remained `user` (protected) — PASSED
  - Inspect `data/db.json`: refresh token(s) stored server-side for the user (not returned to client) — CONFIRMED
  - POST /api/auth/refresh with a stored refresh token: returned a new access token (server refresh flow still functions when a valid refresh token is supplied directly) — PASSED

Verification & build
- Ran TypeScript check (`npm run lint`) and project build (`npm run build`) during earlier verification — both succeeded.
- Manual API verification performed using `node scripts/run_auth_tests.js` (output saved in terminal session).

Risk & regression
- Regression risk: Low-to-medium for auth/profile flows. Changes are surgical and limited to server-side sanitization and DTO mapping.
- Recommended follow-ups: add automated unit tests for profile update whitelisting and response sanitization to prevent regressions.

Remaining open issues
- B-01, B-04, B-05, B-06, B-07 remain open per `BUG_TRACKER.md`.

Next steps
- Create a lightweight PR containing the `server.ts` patch (if not already in VCS) and include `FIX_REPORT_PHASE1.md` for reviewers.
- Add automated tests for the auth/profile behavior and include them in CI.

Prepared by: GitHub Copilot (GPT-5 mini)

# BUG_TRACKER — Master Issue Tracker

This master tracker contains every confirmed issue from the QA audit. Use this as the single source of truth for status and assignment.

| Bug ID | Title | Severity | Category | Current Status | Affected Files | Assigned Fix Phase | Dependencies | Regression Risk | Verification Status |
|--------|-------|----------|----------|----------------|----------------|--------------------|--------------|-----------------|--------------------|
| B-02 | Profile update allows mass assignment | BLOCKER | Authentication, Authorization, Security, Backend | Fixed | server.ts (PUT /api/auth/me) | Phase 1 - Release Blockers | auth middleware, db model | High | Verified — Whitelist applied; protected fields ignored; tested (signup/login/GET/PUT) |
| B-03 | Auth endpoints return sensitive user data | BLOCKER | Security, Backend, Authentication | Fixed | server.ts (POST /api/auth/login, GET /api/auth/me) | Phase 1 - Release Blockers | auth controller, token issuance | High | Verified — Responses no longer include password or refreshTokens; tested (signup/login/GET) |
| B-04 | Notification read endpoint not ownership-scoped | CRITICAL | Backend, Security, Notifications | Fixed | server.ts (PUT /api/notifications/:id/read) | Phase 2 - Critical | notifications model, auth middleware | Medium | Verified — Endpoint now validates `userId` ownership and returns 403 for unauthorized attempts; tested with automated script |
| B-01 | Google Calendar linking flow broken | HIGH | Calendar, Frontend, Backend, UI/UX | Fixed | src/screens/SettingsScreen.tsx, src/App.tsx, server.ts | Phase 3 - High | Google OAuth credentials, server endpoints | Medium | Verified — OAuth link/callback endpoints added, popup handoff fixed, link state persisted (`googleCalendarLinked`), simulated regression test passed |
| B-06 | Rescue ignores selected task inputs | MEDIUM | AI Engine, Backend, Scheduler, UI/UX | Open | server.ts (POST /api/ai/rescue), src/App.tsx | Phase 4 - Medium | AI engine inputs | Medium | Not verified |
| B-07 | Subtask toggle can throw when cache missing | MEDIUM | Frontend, UI/UX, Code Quality | Open | src/screens/TasksScreen.tsx | Phase 4 - Medium | frontend state init | Low | Not verified |
| B-05 | Desktop notification enablement not synced | LOW | Frontend, Notifications, UI/UX | Open | src/screens/SettingsScreen.tsx, src/App.tsx | Phase 5 - Low | app notification state | Low | Not verified |

Guidance:
- Update this file when a bug state changes (e.g., Open → In Progress → In Review → Fixed → Verified).
- On fix completion, add the PR link and verification notes in the `Verification Status` column.

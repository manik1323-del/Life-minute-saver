# USER_JOURNEY_QA_REPORT

Purpose: Provide user-journey focused QA checks to validate end-to-end behaviors and UX acceptance criteria.

Journeys and Checks

1) New user signup + first-run flow
- Preconditions: Local dev server running
- Steps:
  1. Open app, click Log In and provide email/password (new email).
 2. Confirm account auto-creation, receive tokens, app routes to Dashboard.
 3. Confirm initial organization/team/project appears in workspace.
- Acceptance: User lands on Dashboard, sample data seeded, no errors in console.

2) Returning user login + session persistence
- Steps:
  1. Log in with existing user.
 2. Confirm tokens stored in `localStorage` keys `last_minute_token` and `last_minute_refresh_token`.
 3. Refresh browser and confirm user remains authenticated and view persists.
- Acceptance: Session remains active after refresh; no re-login required.

3) Create task → AI breakdown → Schedule integration
- Steps:
  1. Create a new task from Tasks screen.
 2. Run AI breakdown on the task and create subtasks.
 3. Regenerate schedule and confirm subtasks or tasks appear in today's schedule.
- Acceptance: AI breakdown returns subtasks; schedule includes items referencing created tasks.

4) Goal creation → Link tasks → Dashboard visibility
- Steps:
  1. Create a goal with milestones.
 2. Link tasks to milestone (via UI if supported).
 3. Confirm goal appears in Goals screen and dashboard counts update.
- Acceptance: Goal and milestones present with counts correct.

5) Rescue flow (Emergency Rescue)
- Steps:
  1. Open Rescue modal, select subset of tasks and available hours.
 2. Run rescue and inspect returned plan.
- Acceptance: Plan references only selected tasks and respects `availableHours`.

6) Notifications and desktop alerts
- Steps:
  1. Enable browser notifications via Settings.
 2. Trigger notification (e.g., create task assigned to user) and confirm native toast appears.
- Acceptance: Native desktop notification appears immediately and notification list updated.

7) Workspace collaboration (comments + reactions + sockets)
- Steps:
  1. Open two browser windows as the same org (two users or two sessions).
 2. Post a comment on a task from one window; confirm the other window receives `workspace:comment-created` and UI updates.
  3. Add reaction and confirm propagation.
- Acceptance: Real-time events propagate and UI updates reflect them.

8) Calendar linking and meeting sync
- Steps:
  1. Attempt to link Google Calendar via Settings.
 2. Complete OAuth and confirm meetings appear in Calendar and schedule regeneration accounts for meetings.
- Acceptance: Linked calendar events appear and block focus windows appropriately.

9) Settings & theme
- Steps:
  1. Change display name, work hours, focus period, and theme.
 2. Save and confirm changes persist across refresh and affect scheduling and UI.
- Acceptance: Settings saved and applied immediately.

10) AI Coach chat and history
- Steps:
  1. Open Coach screen and send a prompt.
 2. Confirm AI reply returns and appears in chat history.
- Acceptance: Chat history persists and coach responds.

Verification: Run through each journey in a clean browser session and note console/server logs for errors. Use API calls for boundary verification where UI is not exhaustive.

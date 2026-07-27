# TEST_CASES — QA Test Cases

Each test case includes: Test ID, Description, Preconditions, Steps, Expected Result, Pass/Fail

AUTHENTICATION

TC-A1
- Description: User signup (auto-create on login supported)
- Preconditions: App running, no account for test@example.com
- Steps:
  1. POST /api/auth/login { email: test@example.com, password: password123 }
  2. Verify 200 and tokens returned.
- Expected Result: Account created, `token` and `refreshToken` returned, `user` sanitized.

TC-A2
- Description: Login with existing user
- Preconditions: User exists with password
- Steps: POST /api/auth/login
- Expected Result: 200, tokens issued

PROFILE

TC-P1
- Description: Update allowed profile fields
- Preconditions: Auth token
- Steps: PUT /api/auth/me with { name, workHoursStart }
- Expected Result: 200, fields updated, sensitive fields unchanged

TC-P2
- Description: Attempt mass-assignment attack
- Preconditions: Auth token
- Steps: PUT /api/auth/me with { role: 'admin', refreshTokens: [] }
- Expected Result: Request either ignores sensitive fields or returns 400/403

DASHBOARD / TASKS

TC-T1
- Description: Create task and list
- Preconditions: Auth token
- Steps: POST /api/tasks, then GET /api/tasks
- Expected Result: Task appears in list

TC-T2
- Description: Create and toggle subtask
- Preconditions: Task exists
- Steps: POST /api/subtasks, then PUT /api/subtasks/:id (toggle)
- Expected Result: Subtask toggles; client UI updates without errors

GOALS

TC-G1
- Description: Create goal with milestone
- Preconditions: Auth token
- Steps: POST /api/goals with milestones; GET /api/goals
- Expected Result: Goal and milestone present; recommendedTaskMap returned

WORKSPACE / PROJECTS / TEAMS

TC-W1
- Description: Create organization and fetch organizations
- Preconditions: Auth token
- Steps: POST /api/workspace/organizations; GET /api/workspace/organizations
- Expected Result: New org appears in list and returned detail includes teams/projects arrays

AI COACH / SCHEDULER / RESCUE

TC-AI1
- Description: Chat with AI coach
- Preconditions: Auth token
- Steps: POST /api/ai/chat with message; GET /api/ai/chat
- Expected Result: Coach message returned, history recorded

TC-AI2
- Description: Run emergency rescue with subset
- Preconditions: Auth token, multiple tasks
- Steps: POST /api/ai/rescue with { availableHours, pendingTasks: [subset] }
- Expected Result: Rescue plan uses only submitted pendingTasks

ANALYTICS

TC-AN1
- Description: Fetch analytics
- Preconditions: Auth token
- Steps: GET /api/analytics
- Expected Result: Analytics payload returned and fields present

NOTIFICATIONS

TC-N1
- Description: Receive and mark notification
- Preconditions: Auth token, generate notification
- Steps: Trigger notification; GET /api/notifications; PUT /api/notifications/:id/read by owner
- Expected Result: Owner can mark read; non-owner gets 403

SETTINGS / THEME

TC-S1
- Description: Toggle theme in Settings
- Preconditions: Auth token
- Steps: Update theme via UI or PUT; verify UI appearance
- Expected Result: Theme applied immediately

CALENDAR (Google)

TC-C1
- Description: Link Google Calendar
- Preconditions: Valid Google OAuth app credentials
- Steps: Use Link Google Calendar flow; complete OAuth
- Expected Result: Parent app receives `GOOGLE_CALENDAR_LINKED` and reflects link

SOCKET.IO

TC-SK1
- Description: Real-time comment and reaction propagation
- Preconditions: Two connected clients in same workspace
- Steps: Post a comment from client A; verify it appears on client B via socket event
- Expected Result: Client B receives `workspace:comment-created` and UI updates

ORGANIZATIONS / TEAM PRESENCE

TC-O1
- Description: Create org and add member
- Preconditions: Auth token
- Steps: POST /api/workspace/organizations, add member, inspect presence updates
- Expected Result: Org created and presence events emitted

FOCUS / SESSIONS / BURNOUT / CONSISTENCY / PREDICTION

TC-F1
- Description: Generate schedule for a day
- Preconditions: Tasks and habits exist
- Steps: GET /api/schedules or request regenerate endpoint
- Expected Result: Daily schedule returned with items mapped to tasks/habits

SIMULATIONS / WHAT-IF

TC-SIM1
- Description: Run what-if simulation
- Preconditions: Auth token
- Steps: POST /api/ai/simulate with scenario
- Expected Result: Simulation result returned

Notes:
- Each test should be added to an automated suite when possible (API-level tests first), then to E2E (Cypress/Playwright) for UI flows.

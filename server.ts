import "dotenv/config";

import express from "express";
import http from "http";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { Server as SocketServer } from "socket.io";
import { readDb, writeDb, seedUserData } from "./server/db";
import { supabase } from "./server/supabase";
import { 
  prioritizeTasks, 
  generateSubtasks, 
  planDailySchedule, 
  getCoachResponse, 
  generateAIPredictiveSuggestions,
  generatePredictions,
  simulateWhatIf,
  createGoalPlan,
  runEmergencyRescue,
  computeConsistencyMetrics,
  analyzeAndEnhanceTask
} from "./server/ai";
import { 
  User, Task, Subtask, Habit, Notification, 
  DailySchedule, ScheduleItem, Analytic, CalendarEvent, AISuggestion, ChatMessage,
  Goal, Milestone, Prediction, ConsistencyMetrics, PredictionRecord, ConsistencySnapshot, SimulationHistory, RecoveryPlan,
  Organization, Team, Project, Comment, Reaction, ActivityLog, Invitation, WorkloadRecommendation, PresenceStatus
} from "./src/types";

const JWT_SECRET = process.env.JWT_SECRET || "last-minute-secret-key-focus-2026";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "last-minute-refresh-secret-key-focus-2026";

// Warn if insecure defaults are in use — this is not a blocking error in dev/AI Studio
if (!process.env.JWT_SECRET) {
  console.warn("[SECURITY WARNING] JWT_SECRET is not set. Using insecure default. Set a strong JWT_SECRET environment variable for production.");
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.warn("[SECURITY WARNING] JWT_REFRESH_SECRET is not set. Using insecure default. Set a strong JWT_REFRESH_SECRET environment variable for production.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  try {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .limit(1);

  if (error) {
    console.error("❌ Supabase connection failed:", error.message);
  } else {
    console.log("✅ Supabase connected successfully");
  }
} catch (err) {
  console.error("❌ Unable to connect to Supabase:", err);
}

  // Enable JSON request body parsing
  app.use(express.json());

  // Simple Request Logger
  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.path}`);
    next();
  });

  // ==========================================================
  // JWT MIDDLEWARE FOR DECODING AND AUTHENTICATION
  // ==========================================================
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token === "demo-token-last-minute-life-saver") {
        req.headers.authorization = `Bearer demo-user-001`;
        (req as any).user = { id: "demo-user-001", email: "demo@example.com", role: "user" };
        return next();
      }
      if (token && token.includes(".")) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          // Rewrite the authorization header to contain the raw user ID so that all downstream endpoints continue to work untouched!
          req.headers.authorization = `Bearer ${decoded.id}`;
          (req as any).user = decoded; // Keep decoded payload for role checks
        } catch (err: any) {
          if (err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Access token has expired.", code: "TOKEN_EXPIRED" });
          }
          return res.status(401).json({ error: "Invalid access token." });
        }
      }
    }
    next();
  });

  // Future Ready Role Support helper
  const requireRole = (role: 'user' | 'admin') => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const userPayload = (req as any).user;
      if (!userPayload || userPayload.role !== role) {
        return res.status(403).json({ error: "Access denied. Insufficient permissions." });
      }
      next();
    };
  };

  const getAuthorizedUserId = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    return authHeader?.replace("Bearer ", "") || null;
  };

  const createNotification = (db: any, userId: string, title: string, message: string, type: Notification['type'] = 'info') => {
    const note: Notification = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.push(note);
    return note;
  };

  // Sanitization helpers — do not expose sensitive fields
  const toPublicUser = (user: any) => {
    if (!user) return null;
    const { password, refreshTokens, ...publicUser } = user as any;
    return publicUser as any;
  };

  const sanitizeProfileUpdate = (data: any) => {
    const allowed = ['name', 'theme', 'workHoursStart', 'workHoursEnd', 'focusPeriod'];
    const out: any = {};
    allowed.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        out[k] = data[k];
      }
    });
    return out;
  };

  const createOrganizationForUser = (db: any, user: User) => {
    const orgId = `org-${Date.now()}`;
    const teamId = `team-${Date.now()}`;
    const projectId = `proj-${Date.now()}`;

    const organization: Organization = {
      id: orgId,
      name: `${user.name}'s Organization`,
      description: 'A workspace where your AI productivity OS can scale across teammates, projects, and shared goals.',
      ownerId: user.id,
      memberIds: [user.id],
      teamIds: [teamId],
      projectIds: [projectId],
      createdAt: new Date().toISOString()
    };

    const team: Team = {
      id: teamId,
      organizationId: orgId,
      name: 'Core Collaboration Team',
      description: 'Your first collaborative team for planning and executing high-impact work.',
      memberIds: [user.id],
      projectIds: [projectId],
      createdAt: new Date().toISOString()
    };

    const project: Project = {
      id: projectId,
      organizationId: orgId,
      teamId,
      title: 'AI Productivity Workspace Launch',
      description: 'Expand your productivity system into a collaborative workspace with shared goals, project health metrics, and team coordination.',
      ownerId: user.id,
      managerId: user.id,
      memberIds: [user.id],
      goalIds: [],
      milestoneIds: [],
      taskIds: [],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Active',
      progress: 12,
      riskScore: 22,
      burnoutRisk: 15,
      capacityScore: 82,
      healthScore: 90,
      tags: ['workspace', 'team', 'launch'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.organizations.push(organization);
    db.teams.push(team);
    db.projects.push(project);

    user.organizationIds = [orgId];
    user.teamIds = [teamId];
    user.projectIds = [projectId];
  };

  // ==========================================================
  // GOOGLE CALENDAR OAUTH (Linking) — Phase 3
  // ==========================================================

  const renderPostMessageHtml = (payload: any) => {
    // Simple HTML page that posts a message to the opener window and closes the popup.
    // It performs an origin check on the parent in the client before posting.
    return `<!doctype html><html><head><meta charset="utf-8"><title>Google Calendar Link</title></head><body>
    <script>
      try {
        const data = ${JSON.stringify(payload)};
        if (window.opener && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage({ type: 'GOOGLE_CALENDAR_LINKED', ...data }, window.location.origin);
        }
      } catch(e) {
        console.error(e);
      }
      window.close();
    </script>
    <p>Linking complete. You can close this window.</p>
    </body></html>`;
  };

  app.get('/api/calendar/google/link', (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${req.protocol}://${req.get('host')}/api/calendar/google/callback`;

    // Create a short-lived state token that ties to the current user
    const state = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '10m' });

    if (clientId && process.env.GOOGLE_CLIENT_SECRET) {
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
      return res.redirect(oauthUrl);
    }

    // If no real credentials are configured, emulate a successful flow and notify the opener.
    const html = renderPostMessageHtml({ success: true });
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  });

  app.get('/api/calendar/google/callback', async (req, res) => {
    const { code, state, simulate } = req.query as any;

    if (!state && !simulate) return res.status(400).send('Missing state');
    let payload: any = null;
    if (simulate === 'true') {
      // For simulated test runs, rely on Authorization header instead of state token
      const simUser = getAuthorizedUserId(req);
      if (!simUser) return res.status(401).send('Unauthorized');
      payload = { id: simUser };
    } else {
      try {
        payload = jwt.verify(String(state), JWT_SECRET) as any;
      } catch (e) {
        return res.status(400).send('Invalid state');
      }
    }

    const userId = payload.id as string;
    if (!userId) return res.status(400).send('Invalid state payload');
    const db = readDb();
    const userIdx = db.users.findIndex(u => u.id === userId);
    if (userIdx === -1) return res.status(404).send('User not found');

    // If simulate flag or no client credentials, just mark linked
    if (simulate === 'true' || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      db.users[userIdx].googleCalendarLinked = true;
      writeDb(db);
      const html = renderPostMessageHtml({ success: true });
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // Exchange code for tokens using Google's token endpoint
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/calendar/google/callback`,
          grant_type: 'authorization_code'
        }) as any
      });
      const tokenJson = await tokenRes.json();
      // Persist minimal token info
      db.users[userIdx].googleCalendarLinked = true;
      db.users[userIdx].googleRefreshToken = tokenJson.refresh_token || db.users[userIdx].googleRefreshToken;
      db.users[userIdx].googleAccessToken = tokenJson.access_token;
      writeDb(db);
      const html = renderPostMessageHtml({ success: true });
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err) {
      console.error('Google token exchange failed', err);
      const html = renderPostMessageHtml({ success: false });
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
  });

  const regenerateScheduleForUser = async (db: any, userId: string, date?: string) => {
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return null;

    const targetDate = date || new Date().toISOString().split('T')[0];
    const tasks = db.tasks.filter((t: Task) => t.userId === userId && t.status !== 'Completed');
    const habits = db.habits.filter((h: Habit) => h.userId === userId);
    const meetings = db.calendarEvents.filter((e: CalendarEvent) => e.userId === userId);

    const scheduleItems = await planDailySchedule(tasks, habits, meetings, user.workHoursStart, user.workHoursEnd);
    const newSchedule: DailySchedule = {
      id: `s-auto-${Date.now()}`,
      userId,
      date: targetDate,
      items: scheduleItems.map((item, idx) => ({
        id: `s-item-auto-${Date.now()}-${idx}`,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        type: item.type,
        referenceId: item.referenceId,
        estimatedDuration: item.estimatedDuration,
        priorityScore: item.priorityScore,
        completionProbability: item.completionProbability,
        aiNote: item.aiNote,
        status: item.status
      })),
      createdAt: new Date().toISOString()
    };

    const existingIdx = db.schedules.findIndex((s: DailySchedule) => s.userId === userId && s.date === targetDate);
    if (existingIdx > -1) {
      db.schedules[existingIdx] = newSchedule;
    } else {
      db.schedules.push(newSchedule);
    }

    sendNotification(db, userId, 'Schedule updated', 'Your schedule has been refreshed automatically based on the latest tasks, habits, and calendar changes.', 'success');
    emitWorkspaceEvent('workspace:schedule-updated', { schedule: newSchedule }, getTargetRooms({ userId }));
    return newSchedule;
  };

  const savePredictionRecord = (db: any, userId: string, prediction: Prediction) => {
    db.predictions.push({
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      prediction,
      createdAt: new Date().toISOString()
    });
  };

  const saveConsistencySnapshot = (db: any, userId: string, metrics: ConsistencyMetrics) => {
    db.consistencySnapshots.push({
      id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      metrics,
      createdAt: new Date().toISOString()
    });
  };

  const saveSimulationHistory = (db: any, userId: string, simulationType: string, changes: any, result: any) => {
    db.simulationHistory.push({
      id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      simulationType,
      changes,
      result,
      createdAt: new Date().toISOString()
    });
  };

  const saveRecoveryPlan = (db: any, userId: string, payload: Omit<RecoveryPlan, 'id' | 'createdAt'>) => {
    db.recoveryPlans.push({
      ...payload,
      id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      createdAt: new Date().toISOString()
    });
  };

  const createActivityLog = (db: any, userId: string, action: string, detail: string, organizationId?: string, teamId?: string, projectId?: string) => {
    db.activityLogs.push({
      id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      organizationId,
      teamId,
      projectId,
      action,
      detail,
      createdAt: new Date().toISOString()
    });
  };

  let io: SocketServer | null = null;

  const emitWorkspaceEvent = (eventName: string, payload: any, rooms: string[] = []) => {
    if (!io) return;
    if (rooms.length === 0) {
      io.emit(eventName, payload);
      return;
    }
    rooms.forEach(room => io?.to(room).emit(eventName, payload));
  };

  const presenceMap: Record<string, PresenceStatus> = {};

  const broadcastPresenceUpdate = (userId: string, status: 'online' | 'offline' | 'away' | 'typing') => {
    const presence: PresenceStatus = {
      userId,
      workspaceId: 'workspace-global',
      status,
      lastActiveAt: new Date().toISOString()
    };
    presenceMap[userId] = presence;
    emitWorkspaceEvent('workspace:presence', presence, ['workspace-global', `user-${userId}`]);
  };

  const getTargetRooms = (options: { organizationId?: string; teamId?: string; projectId?: string; taskId?: string; userId?: string; workspaceId?: string } = {}) => {
    const rooms = new Set<string>(['workspace-global']);
    if (options.userId) rooms.add(`user-${options.userId}`);
    if (options.workspaceId) rooms.add(`workspace-${options.workspaceId}`);
    if (options.organizationId) rooms.add(`org-${options.organizationId}`);
    if (options.teamId) rooms.add(`team-${options.teamId}`);
    if (options.projectId) rooms.add(`project-${options.projectId}`);
    if (options.taskId) rooms.add(`task-${options.taskId}`);
    return Array.from(rooms);
  };

  const sendNotification = (db: any, userId: string, title: string, message: string, type: Notification['type'] = 'info') => {
    const note = createNotification(db, userId, title, message, type);
    emitWorkspaceEvent('notification:created', note, [`user-${userId}`]);
    return note;
  };

  const shouldRegenerateForTaskUpdate = (original: Task, updated: Task): boolean => {
    if (original.status !== updated.status) return true;
    if (original.deadline !== updated.deadline) return true;
    if (original.priority !== updated.priority) return true;
    return false;
  };

  // ==========================================================
  // AUTHENTICATION & SETTINGS ENDPOINTS
  // ==========================================================

  // Demo Mode Init Endpoint
  app.get("/api/demo/init", (req, res) => {
    const db = readDb();
    let demoUser = db.users.find(u => u.id === "demo-user-001");
    if (!demoUser) {
      demoUser = {
        id: "demo-user-001",
        email: "demo@example.com",
        name: "Demo User",
        productivityScore: 87,
        theme: "dark",
        workHoursStart: "09:00",
        workHoursEnd: "18:00",
        focusPeriod: 25,
        streakCount: 14,
        role: "user",
        googleCalendarLinked: false,
        organizationIds: ["org-demo-001"],
        teamIds: ["team-demo-001"],
        projectIds: ["proj-demo-001"],
        skills: ["Planning", "Focus", "Time Management"],
        currentWorkload: 72,
        active: true,
        refreshTokens: []
      };

      const orgId = "org-demo-001";
      const teamId = "team-demo-001";
      const projectId = "proj-demo-001";

      if (!db.organizations.find(o => o.id === orgId)) {
        db.organizations.push({
          id: orgId,
          name: "Demo's Organization",
          description: 'A workspace where your AI productivity OS can scale across teammates, projects, and shared goals.',
          ownerId: demoUser.id,
          memberIds: [demoUser.id],
          teamIds: [teamId],
          projectIds: [projectId],
          createdAt: new Date().toISOString()
        });
      }

      if (!db.teams.find(t => t.id === teamId)) {
        db.teams.push({
          id: teamId,
          organizationId: orgId,
          name: 'Core Collaboration Team',
          description: 'Your first collaborative team for planning and executing high-impact work.',
          memberIds: [demoUser.id],
          projectIds: [projectId],
          createdAt: new Date().toISOString()
        });
      }

      if (!db.projects.find(p => p.id === projectId)) {
        db.projects.push({
          id: projectId,
          organizationId: orgId,
          teamId,
          title: 'AI Productivity Workspace Launch',
          description: 'Expand your productivity system into a collaborative workspace with shared goals, project health metrics, and team coordination.',
          ownerId: demoUser.id,
          managerId: demoUser.id,
          memberIds: [demoUser.id],
          goalIds: [],
          milestoneIds: [],
          taskIds: [],
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Active',
          progress: 12,
          riskScore: 22,
          burnoutRisk: 15,
          capacityScore: 82,
          healthScore: 90,
          tags: ['workspace', 'team', 'launch'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      db.users.push(demoUser);
      writeDb(db);
      seedUserData(demoUser.id);
    }

    return res.json({ success: true, user: toPublicUser(demoUser) });
  });

  // Signup Endpoint
  app.post("/api/auth/signup", async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required." });
    }

    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const db = readDb();
    const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email." });
    }

    // Hash the password with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: `u-${Date.now()}`,
      email: email.toLowerCase(),
      name,
      productivityScore: 82,
      theme: "dark",
      workHoursStart: "09:00",
      workHoursEnd: "18:00",
      focusPeriod: 25,
      streakCount: 1,
      password: hashedPassword,
      role: "user",
      refreshTokens: []
    };

    const accessToken = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role }, 
      JWT_SECRET, 
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { id: newUser.id }, 
      JWT_REFRESH_SECRET, 
      { expiresIn: "7d" }
    );

    newUser.refreshTokens = [refreshToken];

    createOrganizationForUser(db, newUser);
    db.users.push(newUser);
    writeDb(db);

    // Seed demographic demo tasks, subtasks, habits, and schedules
    seedUserData(newUser.id);

    return res.json({ token: accessToken, user: toPublicUser(newUser) });
  });

  // Login Endpoint
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // For demo ease, auto-create and login user
      if (!password) {
        return res.status(400).json({ error: "Password is required to initiate account." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      const defaultName = email.split('@')[0];
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser: User = {
        id: `u-${Date.now()}`,
        email: email.toLowerCase(),
        name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
        productivityScore: 85,
        theme: "dark",
        workHoursStart: "09:00",
        workHoursEnd: "18:00",
        focusPeriod: 25,
        streakCount: 3,
        password: hashedPassword,
        role: "user",
        refreshTokens: []
      };

      const accessToken = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role }, 
        JWT_SECRET, 
        { expiresIn: "15m" }
      );
      const refreshToken = jwt.sign(
        { id: newUser.id }, 
        JWT_REFRESH_SECRET, 
        { expiresIn: "7d" }
      );

      newUser.refreshTokens = [refreshToken];

      createOrganizationForUser(db, newUser);
      db.users.push(newUser);
      writeDb(db);
      seedUserData(newUser.id);

      return res.json({ token: accessToken, user: toPublicUser(newUser) });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    // Handle backward compatibility for seeded users without a password
    if (!user.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;
      user.role = "user";
    } else {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials." });
      }
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "user" }, 
      JWT_SECRET, 
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { id: user.id }, 
      JWT_REFRESH_SECRET, 
      { expiresIn: "7d" }
    );

    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }
    user.refreshTokens.push(refreshToken);

    // Limit active sessions in in-memory JSON db to 5 maximum
    if (user.refreshTokens.length > 5) {
      user.refreshTokens.shift();
    }

    writeDb(db);

    return res.json({ token: accessToken, user: toPublicUser(user) });
  });

  // Token Refresh Endpoint
  app.post("/api/auth/refresh", (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required." });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      const db = readDb();
      const user = db.users.find(u => u.id === decoded.id);

      if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
        return res.status(403).json({ error: "Invalid refresh token or session expired." });
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role || "user" }, 
        JWT_SECRET, 
        { expiresIn: "15m" }
      );

      return res.json({ token: accessToken });
    } catch (err) {
      return res.status(403).json({ error: "Invalid refresh token." });
    }
  });

  // Logout Endpoint
  app.post("/api/auth/logout", (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const db = readDb();
      try {
        const decoded = jwt.decode(refreshToken) as any;
        if (decoded && decoded.id) {
          const user = db.users.find(u => u.id === decoded.id);
          if (user && user.refreshTokens) {
            user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
            writeDb(db);
          }
        }
      } catch (err) {
        // Ignore parsing errors on logout
      }
    }
    return res.json({ success: true, message: "Logged out successfully." });
  });

  // Forgot Password — Note: email delivery not yet implemented; returns informational message
  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });
    // TODO: Implement actual email reset delivery (e.g. via SendGrid/Resend)
    return res.json({ message: `If an account exists for ${email}, a password reset link will be sent. (Email delivery coming in a future phase.)` });
  });

  // Retrieve current profile
  app.get("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const db = readDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json(toPublicUser(user));
  });

  // Update Settings (Theme, focusPeriod, workHours)
  app.put("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const db = readDb();
    const userIdx = db.users.findIndex(u => u.id === userId);
    if (userIdx === -1) {
      return res.status(404).json({ error: "User not found." });
    }

    const safeUpdates = sanitizeProfileUpdate(req.body || {});
    const updatedUser = {
      ...db.users[userIdx],
      ...safeUpdates
    };

    db.users[userIdx] = updatedUser;
    writeDb(db);

    return res.json(toPublicUser(updatedUser));
  });

  const calculateTaskProgress = (db: any, taskId: string): number => {
    const taskSubtasks = db.subtasks.filter((s: Subtask) => s.taskId === taskId);
    if (taskSubtasks.length === 0) {
      const task = db.tasks.find((t: Task) => t.id === taskId);
      return task?.status === 'Completed' ? 100 : 0;
    }
    const completedWeight = taskSubtasks
      .filter((s: Subtask) => s.completed)
      .reduce((sum: number, s: Subtask) => sum + (s.weightage || 0), 0);
    return Math.min(100, Math.round(completedWeight));
  };

  const calculateGoalProgress = (db: any, goalId: string): number => {
    const goalTasks = db.tasks.filter((t: Task) => t.goalId === goalId);
    if (goalTasks.length === 0) return 0;
    const totalProgress = goalTasks.reduce((sum: number, t: Task) => sum + (t.progress || 0), 0);
    return Math.round(totalProgress / goalTasks.length);
  };

  const calculateProjectProgress = (db: any, projectId: string): number => {
    const projectTasks = db.tasks.filter((t: Task) => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const totalProgress = projectTasks.reduce((sum: number, t: Task) => sum + (t.progress || 0), 0);
    return Math.round(totalProgress / projectTasks.length);
  };

  const syncTaskChanges = async (db: any, userId: string, taskId: string) => {
    const taskIdx = db.tasks.findIndex((t: Task) => t.id === taskId);
    if (taskIdx === -1) return;

    // 1. Recalculate Task Progress
    const progress = calculateTaskProgress(db, taskId);
    db.tasks[taskIdx].progress = progress;
    if (progress === 100 && db.tasks[taskIdx].status !== 'Completed') {
      db.tasks[taskIdx].status = 'Completed';
    } else if (progress < 100 && db.tasks[taskIdx].status === 'Completed') {
      db.tasks[taskIdx].status = 'In Progress';
    }

    const task = db.tasks[taskIdx];

    // 2. Sync Goal Progress if linked
    if (task.goalId) {
      const goalIdx = db.goals.findIndex((g: Goal) => g.id === task.goalId);
      if (goalIdx > -1) {
        db.goals[goalIdx].progress = calculateGoalProgress(db, task.goalId);
        if (db.goals[goalIdx].progress === 100) db.goals[goalIdx].status = 'Completed';
        emitWorkspaceEvent('workspace:goal-updated', { goal: db.goals[goalIdx] }, getTargetRooms({ userId }));
      }
    }

    // 3. Sync Project Progress if linked
    if (task.projectId) {
      const projIdx = db.projects.findIndex((p: Project) => p.id === task.projectId);
      if (projIdx > -1) {
        db.projects[projIdx].progress = calculateProjectProgress(db, task.projectId);
        if (db.projects[projIdx].progress === 100) db.projects[projIdx].status = 'Completed';
        emitWorkspaceEvent('workspace:project-updated', { project: db.projects[projIdx] }, getTargetRooms({ userId, projectId: task.projectId }));
      }
    }

    // 4. Regenerate Schedule
    await regenerateScheduleForUser(db, userId);

    // 5. Global Real-time Synchronization
    emitWorkspaceEvent('workspace:task-updated', { task }, getTargetRooms({ userId, taskId }));
    emitWorkspaceEvent('workspace:dashboard-refresh', { userId }, [`user-${userId}`]);
    emitWorkspaceEvent('workspace:analytics-refresh', { userId }, [`user-${userId}`]);
    emitWorkspaceEvent('workspace:sync-all', { userId }, [`user-${userId}`]);
  };

  // ==========================================================
  // TASK MANAGEMENT ENDPOINTS
  // ==========================================================

  // Get Tasks
  app.get("/api/tasks", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        const tasks = data.map((row: any) => ({
          id: row.id,
          userId: row.user_id || row.userId,
          title: row.title,
          description: row.description || '',
          deadline: row.deadline || new Date().toISOString(),
          priority: row.priority || 'Medium',
          status: row.status || 'Pending',
          estimatedTime: Number(row.estimated_time ?? row.estimatedTime) || 60,
          category: row.category || 'Work',
          tags: Array.isArray(row.tags) ? row.tags : [],
          difficulty: row.difficulty || 'Medium',
          preferredWorkingTime: row.preferred_working_time || row.preferredWorkingTime,
          isRecurring: !!(row.is_recurring ?? row.isRecurring),
          recurringFrequency: row.recurring_frequency || row.recurringFrequency,
          progress: Number(row.progress) || 0,
          priorityScore: Number(row.priority_score ?? row.priorityScore) || 50,
          deadlineRisk: Number(row.deadline_risk ?? row.deadlineRisk) || 30,
          estimatedEffort: row.estimated_effort ?? row.estimatedEffort,
          aiSuggestedPriority: row.ai_suggested_priority || row.aiSuggestedPriority,
          aiSuggestedTimeBlock: row.ai_suggested_time_block || row.aiSuggestedTimeBlock,
          projectId: row.project_id || row.projectId,
          teamId: row.team_id || row.teamId,
          organizationId: row.organization_id || row.organizationId,
          missedTaskHistory: !!(row.missed_task_history ?? row.missedTaskHistory),
          createdAt: row.created_at || row.createdAt || new Date().toISOString(),
          updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
        }));
        return res.json(tasks);
      }
    } catch (err) {
      console.warn('Supabase fetch failed, fallback to local db:', err);
    }

    const db = readDb();
    const userTasks = db.tasks.filter(t => t.userId === userId);
    return res.json(userTasks);
  });

  // Create Task
  app.post("/api/tasks", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      title, description, deadline, priority, estimatedTime, category, tags,
      projectId, teamId, organizationId, difficulty, preferredWorkingTime,
      isRecurring, recurringFrequency, subtasks, estimatedEffort,
      aiSuggestedPriority, aiSuggestedTimeBlock
    } = req.body;

    if (!title) return res.status(400).json({ error: "Task title is required." });

    const taskId = `t-${Date.now()}`;
    let progress = 0;
    const subtaskRecords: Subtask[] = [];

    if (Array.isArray(subtasks) && subtasks.length > 0) {
      const totalWeight = subtasks.reduce((sum, s) => sum + (Number(s.weightage) || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        return res.status(400).json({ error: "Total subtask weightage must equal 100%." });
      }

      subtasks.forEach((s, idx) => {
        subtaskRecords.push({
          id: `st-${Date.now()}-${idx}`,
          taskId,
          title: s.title || `Subtask ${idx + 1}`,
          description: s.description || '',
          completed: !!s.completed,
          estimatedTime: Number(s.estimatedTime) || 15,
          deadline: s.deadline,
          priority: s.priority,
          weightage: Number(s.weightage) || 0,
          order: idx + 1
        });
      });
      progress = subtaskRecords.filter(s => s.completed).reduce((sum, s) => sum + s.weightage, 0);
    }

    const newTask: Task = {
      id: taskId,
      userId,
      title: title || "Untitled Task",
      description: description || "",
      deadline: deadline || new Date(Date.now() + 24*3600*1000).toISOString(),
      priority: priority || "Medium",
      status: progress === 100 ? "Completed" : "Pending",
      estimatedTime: Number(estimatedTime) || 60,
      category: category || "Work",
      tags: tags || [],
      difficulty: difficulty || "Medium",
      preferredWorkingTime,
      isRecurring: !!isRecurring,
      recurringFrequency,
      progress,
      priorityScore: 50,
      deadlineRisk: 30,
      estimatedEffort,
      aiSuggestedPriority,
      aiSuggestedTimeBlock,
      projectId,
      teamId,
      organizationId,
      missedTaskHistory: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Try Supabase Insert
    try {
      await supabase.from('tasks').insert({
        id: newTask.id,
        user_id: newTask.userId,
        title: newTask.title,
        description: newTask.description || '',
        deadline: newTask.deadline,
        priority: newTask.priority,
        status: newTask.status,
        estimated_time: newTask.estimatedTime,
        category: newTask.category,
        tags: newTask.tags,
        difficulty: newTask.difficulty,
        preferred_working_time: newTask.preferredWorkingTime || null,
        is_recurring: newTask.isRecurring,
        recurring_frequency: newTask.recurringFrequency || null,
        progress: newTask.progress,
        priority_score: newTask.priorityScore,
        deadline_risk: newTask.deadlineRisk,
        estimated_effort: newTask.estimatedEffort || null,
        ai_suggested_priority: newTask.aiSuggestedPriority || null,
        ai_suggested_time_block: newTask.aiSuggestedTimeBlock || null,
        project_id: newTask.projectId || null,
        team_id: newTask.teamId || null,
        organization_id: newTask.organizationId || null,
        missed_task_history: newTask.missedTaskHistory,
        created_at: newTask.createdAt,
        updated_at: newTask.updatedAt,
      });
    } catch (sbErr) {
      console.warn('Supabase insert failed, backup to db.json:', sbErr);
    }

    // 2. Save to local db.json sync
    const db = readDb();
    db.tasks.push(newTask);
    if (subtaskRecords.length > 0) {
      db.subtasks.push(...subtaskRecords);
    }
    createActivityLog(db, userId, 'Created task', `Added task "${newTask.title}"`, newTask.organizationId, newTask.teamId, newTask.projectId);
    writeDb(db);

    sendNotification(db, userId, 'New Task Created', `Task “${newTask.title}” was added to your workflow.`, 'success');

    return res.json(newTask);
  });

  // Edit Task
  app.put("/api/tasks/:id", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const taskId = req.params.id;
    const db = readDb();
    const taskIdx = db.tasks.findIndex(t => t.id === taskId && t.userId === userId);
    if (taskIdx === -1) {
      return res.status(404).json({ error: "Task not found." });
    }

    const previousTask = db.tasks[taskIdx];
    const updatedTask = {
      ...previousTask,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    if (updatedTask.status === 'Completed' && previousTask.status !== 'Completed') {
      // Production fix: Marking task as complete manually should finish all subtasks
      db.subtasks.forEach((s: Subtask) => {
        if (s.taskId === taskId) s.completed = true;
      });
    }

    db.tasks[taskIdx] = updatedTask;

    if (previousTask.status !== updatedTask.status) {
      createActivityLog(db, userId, 'Updated task status', `Task "${updatedTask.title}" is now ${updatedTask.status}`, updatedTask.organizationId, updatedTask.teamId, updatedTask.projectId);
    }

    if (previousTask.goalId !== updatedTask.goalId) {
      // Sync progress for both old and new goals
      if (previousTask.goalId) {
        const oldGoalIdx = db.goals.findIndex((g: Goal) => g.id === previousTask.goalId);
        if (oldGoalIdx > -1) {
          db.goals[oldGoalIdx].progress = calculateGoalProgress(db, previousTask.goalId);
          emitWorkspaceEvent('workspace:goal-updated', { goal: db.goals[oldGoalIdx] }, getTargetRooms({ userId }));
        }
      }
    }

    await syncTaskChanges(db, userId, taskId);
    writeDb(db);
    return res.json(db.tasks[taskIdx]);
  });

  // Delete Task
  app.delete("/api/tasks/:id", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const taskId = req.params.id;
    const db = readDb();
    const task = db.tasks.find((t: Task) => t.id === taskId && t.userId === userId);
    if (!task) return res.status(404).json({ error: "Task not found." });

    db.tasks = db.tasks.filter((t: Task) => !(t.id === taskId && t.userId === userId));
    db.subtasks = db.subtasks.filter((s: Subtask) => s.taskId !== taskId);

    // Sync progress of related entities
    if (task.goalId) {
      const goalIdx = db.goals.findIndex((g: Goal) => g.id === task.goalId);
      if (goalIdx > -1) {
        db.goals[goalIdx].progress = calculateGoalProgress(db, task.goalId);
        emitWorkspaceEvent('workspace:goal-updated', { goal: db.goals[goalIdx] }, getTargetRooms({ userId }));
      }
    }
    if (task.projectId) {
      const projIdx = db.projects.findIndex((p: Project) => p.id === task.projectId);
      if (projIdx > -1) {
        db.projects[projIdx].progress = calculateProjectProgress(db, task.projectId);
        emitWorkspaceEvent('workspace:project-updated', { project: db.projects[projIdx] }, getTargetRooms({ userId, projectId: task.projectId }));
      }
    }

    await regenerateScheduleForUser(db, userId);
    writeDb(db);

    emitWorkspaceEvent('workspace:task-deleted', { taskId, userId }, getTargetRooms({ userId, taskId }));
    sendNotification(db, userId, 'Task Deleted', `A task has been removed from your board.`, 'info');
    return res.json({ success: true });
  });

  // ==========================================================
  // SUBTASK ENDPOINTS
  // ==========================================================

  // Get Subtasks for specific Task
  app.get("/api/tasks/:id/subtasks", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const taskId = req.params.id;
    const db = readDb();
    // Verify the parent task belongs to the requesting user
    const task = db.tasks.find(t => t.id === taskId && t.userId === userId);
    if (!task) return res.status(404).json({ error: "Task not found." });

    const subs = db.subtasks.filter(s => s.taskId === taskId).sort((a,b) => a.order - b.order);
    return res.json(subs);
  });

  // Create Subtask
  app.post("/api/subtasks", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { taskId, title, estimatedTime, weightage, description } = req.body;
    if (!taskId || !title) return res.status(400).json({ error: "Missing parameters" });

    const db = readDb();
    // Verify task belongs to user before allowing subtask creation
    const task = db.tasks.find(t => t.id === taskId && t.userId === userId);
    if (!task) return res.status(404).json({ error: "Task not found." });

    const existingSubs = db.subtasks.filter((s: Subtask) => s.taskId === taskId);
    const totalWeight = existingSubs.reduce((sum: number, s: Subtask) => sum + s.weightage, 0);
    
    if (totalWeight + Number(weightage) > 100.1) {
      return res.status(400).json({ error: `Cannot add subtask. Total weightage would exceed 100% (currently ${totalWeight}%).` });
    }

    const existingSubsCount = existingSubs.length;

    const newSub: Subtask = {
      id: `st-${Date.now()}`,
      taskId,
      title,
      description,
      completed: false,
      estimatedTime: Number(estimatedTime) || 15,
      weightage: Number(weightage) || 0,
      order: existingSubsCount + 1
    };

    db.subtasks.push(newSub);
    await syncTaskChanges(db, userId, taskId);
    writeDb(db);
    return res.json(newSub);
  });

  // Update Subtask
  app.put("/api/subtasks/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const subId = req.params.id;
    const db = readDb();
    const idx = db.subtasks.findIndex(s => s.id === subId);
    if (idx === -1) return res.status(404).json({ error: "Subtask not found" });

    // Verify parent task belongs to requesting user
    const task = db.tasks.find(t => t.id === db.subtasks[idx].taskId && t.userId === userId);
    if (!task) return res.status(403).json({ error: "Access denied." });

    const updatedSub = {
      ...db.subtasks[idx],
      ...req.body
    };
    db.subtasks[idx] = updatedSub;
    await syncTaskChanges(db, userId, updatedSub.taskId);
    writeDb(db);
    return res.json(updatedSub);
  });

  // Delete Subtask
  app.delete("/api/subtasks/:id", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const subId = req.params.id;
    const db = readDb();
    const sub = db.subtasks.find(s => s.id === subId);
    if (!sub) return res.status(404).json({ error: "Subtask not found." });

    // Verify parent task belongs to requesting user
    const task = db.tasks.find(t => t.id === sub.taskId && t.userId === userId);
    if (!task) return res.status(403).json({ error: "Access denied." });

    const taskId = sub.taskId;
    db.subtasks = db.subtasks.filter(s => s.id !== subId);
    await syncTaskChanges(db, userId, taskId);
    writeDb(db);
    return res.json({ success: true });
  });

  // ==========================================================
  // HABIT TRACKER ENDPOINTS
  // ==========================================================

  // Get Habits
  app.get("/api/habits", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    return res.json(db.habits.filter(h => h.userId === userId));
  });

  // Create Habit
  app.post("/api/habits", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, category, frequency } = req.body;
    if (!title) return res.status(400).json({ error: "Habit title is required." });

    const db = readDb();
    const newHabit: Habit = {
      id: `h-${Date.now()}`,
      userId,
      title: title || "New Habit",
      category: category || "Meditation",
      frequency: frequency || "Daily",
      streaks: 0,
      history: [],
      createdAt: new Date().toISOString()
    };

    db.habits.push(newHabit);
    await regenerateScheduleForUser(db, userId);
    writeDb(db);
    return res.json(newHabit);
  });

  // Toggle Habit completion for a date
  app.post("/api/habits/:id/toggle", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const habitId = req.params.id;
    const { date } = req.body; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: "Date parameter is required" });

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be in YYYY-MM-DD format." });
    }

    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      return res.status(400).json({ error: "Cannot record habit completion for future dates." });
    }

    const db = readDb();
    const habitIdx = db.habits.findIndex((h: Habit) => h.id === habitId && h.userId === userId);
    if (habitIdx === -1) return res.status(404).json({ error: "Habit not found" });

    const habit = db.habits[habitIdx];
    const dateIndex = habit.history.indexOf(date);
    
    if (dateIndex > -1) {
      habit.history.splice(dateIndex, 1);
    } else {
      habit.history.push(date);

      const analyticIdx = db.analytics.findIndex((a: Analytic) => a.userId === habit.userId && a.date === date);
      if (analyticIdx > -1) {
        db.analytics[analyticIdx].score = Math.min(100, db.analytics[analyticIdx].score + 5);
      }
    }

    const sortedHistory = [...habit.history].sort();
    let streak = 0;
    if (sortedHistory.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      let checkDate = sortedHistory.includes(today) ? today : sortedHistory[sortedHistory.length - 1];
      let d = new Date(checkDate);
      while (sortedHistory.includes(d.toISOString().split('T')[0])) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
    }
    habit.streaks = streak;

    db.habits[habitIdx] = habit;
    await regenerateScheduleForUser(db, userId);
    writeDb(db);
    return res.json(habit);
  });

  // Delete Habit
  app.delete("/api/habits/:id", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const habitId = req.params.id;
    const db = readDb();
    const habit = db.habits.find((h: Habit) => h.id === habitId && h.userId === userId);
    if (!habit) return res.status(404).json({ error: "Habit not found." });

    db.habits = db.habits.filter((h: Habit) => h.id !== habitId);
    await regenerateScheduleForUser(db, userId);
    writeDb(db);
    return res.json({ success: true });
  });

  // ==========================================================
  // NOTIFICATION ENDPOINTS
  // ==========================================================

  // Get notifications
  app.get("/api/notifications", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const list = db.notifications
      .filter((n: Notification) => n.userId === userId)
      .sort((a: Notification, b: Notification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json(list);
  });

  // Mark notification read
  app.put("/api/notifications/:id/read", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const noteId = req.params.id;
    const db = readDb();
    const idx = db.notifications.findIndex((n: Notification) => n.id === noteId);
    if (idx === -1) {
      return res.status(404).json({ error: "Notification not found." });
    }

    const note: Notification = db.notifications[idx];
    if (note.userId !== userId) {
      return res.status(403).json({ error: "Forbidden. Cannot modify another user's notification." });
    }

    db.notifications[idx].read = true;
    writeDb(db);
    return res.json({ success: true });
  });

  // ==========================================================
  // SCHEDULE ENDPOINTS
  // ==========================================================

  // Get Daily Schedule
  app.get("/api/schedules", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const db = readDb();
    const sched = db.schedules.find(s => s.userId === userId && s.date === date);
    return res.json(sched || { id: "", userId, date, items: [] });
  });

  // Create manual schedule item
  app.post("/api/schedules/item", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { date, title, startTime, endTime, type } = req.body;
    const db = readDb();
    
    let schedule = db.schedules.find(s => s.userId === userId && s.date === date);
    if (!schedule) {
      schedule = {
        id: `s-${Date.now()}`,
        userId,
        date,
        items: [],
        createdAt: new Date().toISOString()
      };
      db.schedules.push(schedule);
    }

    const newItem: ScheduleItem = {
      id: `s-item-${Date.now()}`,
      title,
      startTime,
      endTime,
      type
    };

    schedule.items.push(newItem);
    schedule.items.sort((a, b) => a.startTime.localeCompare(b.startTime));
    writeDb(db);
    sendNotification(db, userId, 'Schedule added', `A new schedule item was created for ${date}.`, 'success');
    emitWorkspaceEvent('workspace:schedule-updated', { schedule }, getTargetRooms({ userId }));
    return res.json(schedule);
  });

  // Delete manual schedule item
  app.delete("/api/schedules/:scheduleId/items/:itemId", (req, res) => {
    const { scheduleId, itemId } = req.params;
    const db = readDb();
    const schedIdx = db.schedules.findIndex(s => s.id === scheduleId);
    if (schedIdx > -1) {
      db.schedules[schedIdx].items = db.schedules[schedIdx].items.filter(item => item.id !== itemId);
      writeDb(db);
      sendNotification(db, db.schedules[schedIdx].userId, 'Schedule removed', 'A schedule item was removed from your plan.', 'info');
      emitWorkspaceEvent('workspace:schedule-updated', { scheduleId, itemId }, getTargetRooms({ userId: db.schedules[schedIdx].userId }));
    }
    return res.json({ success: true });
  });

  // ==========================================================
  // ANALYTICS ENDPOINTS
  // ==========================================================
  
  app.get("/api/analytics", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const userAnalytics = db.analytics.filter(a => a.userId === userId);
    return res.json(userAnalytics);
  });

  // Record a completed focus session (called by Pomodoro timer on completion)
  app.post("/api/analytics/focus", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { durationMinutes } = req.body;
    if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes <= 0) {
      return res.status(400).json({ error: "durationMinutes must be a positive number." });
    }

    const db = readDb();
    const todayStr = new Date().toISOString().split('T')[0];
    const analyticIdx = db.analytics.findIndex(a => a.userId === userId && a.date === todayStr);

    if (analyticIdx > -1) {
      db.analytics[analyticIdx].focusTime += durationMinutes;
      db.analytics[analyticIdx].totalWorkTime += durationMinutes;
      // Small score boost per focus session
      db.analytics[analyticIdx].score = Math.min(100, db.analytics[analyticIdx].score + 2);
    } else {
      const newAnalytic: Analytic = {
        id: `a-focus-${Date.now()}`,
        userId,
        date: todayStr,
        tasksCompleted: 0,
        tasksMissed: 0,
        totalWorkTime: durationMinutes,
        focusTime: durationMinutes,
        score: 52,
      };
      db.analytics.push(newAnalytic);
    }

    writeDb(db);
    return res.json({ success: true });
  });

  // ==========================================================
  // CALENDAR SYNC ENDPOINTS
  // ==========================================================

  app.get("/api/calendar", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    return res.json(db.calendarEvents.filter(e => e.userId === userId));
  });

  app.post("/api/calendar", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, startTime, endTime } = req.body;
    if (!startTime || !endTime) return res.status(400).json({ error: "Calendar event startTime and endTime are required." });

    const db = readDb();
    const newEvent: CalendarEvent = {
      id: `ce-${Date.now()}`,
      userId,
      title: title || "New Event",
      startTime,
      endTime,
      source: "local",
      conflictDetected: false
    };

    db.calendarEvents.push(newEvent);
    await regenerateScheduleForUser(db, userId);
    writeDb(db);
    return res.json(newEvent);
  });

  // AI suggestions list
  app.get("/api/ai/suggestions", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    return res.json(db.aiSuggestions.filter(s => s.userId === userId && !s.actioned));
  });

  // ==========================================================
  // GEMINI AI INTEGRATION API HOOKS (SERVER-SIDE ONLY)
  // ==========================================================

  // AI Task Enhancement
  app.post("/api/ai/analyze-task", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required for AI analysis." });

    try {
      const enhancement = await analyzeAndEnhanceTask(title, description || "");
      return res.json(enhancement);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI task analysis failed." });
    }
  });

  // 1. AI Task Prioritization & Urgency scoring
  app.post("/api/ai/prioritize", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const activeTasks = db.tasks.filter(t => t.userId === userId);
    const activeCalendar = db.calendarEvents.filter(e => e.userId === userId);

    if (activeTasks.length === 0) {
      return res.json({ message: "No tasks to prioritize." });
    }

    try {
      const computedScores = await prioritizeTasks(activeTasks, activeCalendar);
      
      // Merge results back to database
      computedScores.forEach(scoreItem => {
        const idx = db.tasks.findIndex(t => t.id === scoreItem.id);
        if (idx > -1) {
          db.tasks[idx].priority = scoreItem.priority || db.tasks[idx].priority;
          db.tasks[idx].priorityScore = scoreItem.priorityScore !== undefined ? scoreItem.priorityScore : db.tasks[idx].priorityScore;
          db.tasks[idx].deadlineRisk = scoreItem.deadlineRisk !== undefined ? scoreItem.deadlineRisk : db.tasks[idx].deadlineRisk;
        }
      });

      writeDb(db);
      return res.json({ success: true, tasks: db.tasks.filter(t => t.userId === userId) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI prioritization failed." });
    }
  });

  // 2. AI Automatic Task Breakdown
  app.post("/api/ai/breakdown", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: "taskId is required" });

    const db = readDb();
    const task = db.tasks.find(t => t.id === taskId && t.userId === userId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    try {
      const generated = await generateSubtasks(task.title, task.description);
      
      // Map to Subtask model and append to db
      const newSubtasks: Subtask[] = generated.map((item, index) => ({
        id: `st-ai-${Date.now()}-${index}`,
        taskId,
        title: item.title,
        description: item.description,
        completed: false,
        estimatedTime: item.estimatedTime,
        weightage: item.weightage || 0,
        order: item.order || index + 1
      }));

      // Remove existing subtasks to re-generate, or merge them. Let's replace for absolute clarity
      db.subtasks = db.subtasks.filter(s => s.taskId !== taskId);
      db.subtasks.push(...newSubtasks);
      writeDb(db);

      return res.json(newSubtasks);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI Task Breakdown failed." });
    }
  });

  // 3. AI Smart Day Planner Scheduling
  app.post("/api/ai/schedule", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const db = readDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const tasks = db.tasks.filter(t => t.userId === userId && t.status !== 'Completed');
    const habits = db.habits.filter(h => h.userId === userId);
    const meetings = db.calendarEvents.filter(e => e.userId === userId); // simple filter

    try {
      const scheduleItems = await planDailySchedule(
        tasks, 
        habits, 
        meetings, 
        user.workHoursStart, 
        user.workHoursEnd
      );

      // Save daily schedule
      let dailySchedIdx = db.schedules.findIndex(s => s.userId === userId && s.date === targetDate);
      const newSchedItems: ScheduleItem[] = scheduleItems.map((item, idx) => ({
        id: `s-item-ai-${Date.now()}-${idx}`,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        type: item.type,
        referenceId: item.referenceId
      }));

      if (dailySchedIdx > -1) {
        db.schedules[dailySchedIdx].items = newSchedItems;
      } else {
        db.schedules.push({
          id: `s-ai-${Date.now()}`,
          userId,
          date: targetDate,
          items: newSchedItems,
          createdAt: new Date().toISOString()
        });
      }

      writeDb(db);
      return res.json({ success: true, schedule: db.schedules.find(s => s.userId === userId && s.date === targetDate) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI Smart Scheduling failed." });
    }
  });

  // 4. AI Productivity Coach Chat Interface
  app.post("/api/ai/chat", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message content is required" });

    const db = readDb();
    const tasks = db.tasks.filter(t => t.userId === userId);

    // Initialise or load history
    if (!db.chatMessages[userId]) {
      db.chatMessages[userId] = [];
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString()
    };
    db.chatMessages[userId].push(userMsg);

    try {
      const aiReply = await getCoachResponse(db.chatMessages[userId].slice(0, -1), message, tasks);

      const coachMsg: ChatMessage = {
        id: `msg-${Date.now()}-coach`,
        role: 'model',
        content: aiReply,
        createdAt: new Date().toISOString()
      };
      db.chatMessages[userId].push(coachMsg);
      writeDb(db);

      return res.json({ message: coachMsg, history: db.chatMessages[userId] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI coach chat failed." });
    }
  });

  // Retrieve chat history
  app.get("/api/ai/chat", (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const history = db.chatMessages[userId] || [];
    return res.json(history);
  });

  // 5. Generate Dynamic AI Predictive Suggestions / Warnings
  app.post("/api/ai/suggestions/refresh", async (req, res) => {
    const authHeader = req.headers.authorization;
    const userId = authHeader?.replace("Bearer ", "");
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const tasks = db.tasks.filter(t => t.userId === userId);
    const habits = db.habits.filter(h => h.userId === userId);

    try {
      const list = await generateAIPredictiveSuggestions(tasks, habits);
      
      // Clear old suggestions, add new ones
      db.aiSuggestions = db.aiSuggestions.filter(s => s.userId !== userId);
      
      const newSuggestions: AISuggestion[] = list.map((item, idx) => ({
        id: `as-ai-${Date.now()}-${idx}`,
        userId,
        taskId: item.taskId,
        title: item.title,
        suggestion: item.suggestion,
        type: item.type,
        actioned: false,
        createdAt: new Date().toISOString()
      }));

      db.aiSuggestions.push(...newSuggestions);

      // Create system notifications for each warning too
      newSuggestions.forEach(s => {
        const type = s.type === 'urgency_warning' ? 'warning' : 'reminder';
        const note = createNotification(db, userId, s.title, s.suggestion, type);
        emitWorkspaceEvent('notification:created', note, [`user-${userId}`]);
      });

      writeDb(db);
      return res.json(newSuggestions);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI Suggestion generation failed." });
    }
  });

  // ==========================================================
  // AI PREDICTIONS, SIMULATION, RESCUE, CONSISTENCY, AND GOAL PLANNER
  // ==========================================================

  app.get("/api/ai/predictions", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const tasks = db.tasks.filter((t: Task) => t.userId === userId);
    const habits = db.habits.filter((h: Habit) => h.userId === userId);
    const calendarEvents = db.calendarEvents.filter((e: CalendarEvent) => e.userId === userId);

    try {
      const predictions = await generatePredictions(tasks, habits, calendarEvents);
      savePredictionRecord(db, userId, predictions);
      writeDb(db);
      return res.json(predictions);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unable to calculate AI predictions." });
    }
  });

  app.post("/api/ai/simulate", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { taskId, simulationType, changes } = req.body;
    if (!simulationType || !changes) {
      return res.status(400).json({ error: "simulationType and changes are required." });
    }

    const db = readDb();
    const tasks = db.tasks.filter((t: Task) => t.userId === userId);
    const habits = db.habits.filter((h: Habit) => h.userId === userId);
    const calendarEvents = db.calendarEvents.filter((e: CalendarEvent) => e.userId === userId);

    try {
      const simulationResult = await simulateWhatIf(tasks, habits, calendarEvents, changes);
      const scheduleItems = await planDailySchedule(tasks, habits, calendarEvents, db.users.find((u: User) => u.id === userId)?.workHoursStart || '09:00', db.users.find((u: User) => u.id === userId)?.workHoursEnd || '18:00');
      const priorityChanges = await prioritizeTasks(tasks, calendarEvents);
      const response = {
        updatedSchedule: scheduleItems.map((item, idx) => ({
          id: `s-sim-${Date.now()}-${idx}`,
          ...item
        })),
        priorityChanges,
        burnoutChanges: {
          currentBurnout: simulationResult.predictedChange?.burnoutProbability ?? null,
          notes: simulationResult.notes
        },
        completionProbability: simulationResult.predictedChange?.completionProbability ?? null,
        riskAnalysis: simulationResult.notes,
        explanation: `Simulation ${simulationType} applied${taskId ? ` for ${taskId}` : ''}: ${simulationResult.notes}`
      };

      saveSimulationHistory(db, userId, simulationType, { taskId, changes }, response);
      writeDb(db);
      return res.json(response);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI simulation failed." });
    }
  });

  app.post("/api/ai/rescue", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { availableHours, pendingTasks, deadlines, meetings } = req.body;
    if (availableHours === undefined || availableHours === null) {
      return res.status(400).json({ error: "availableHours is required." });
    }

    const db = readDb();
    let tasks = db.tasks.filter((t: Task) => t.userId === userId && t.status !== 'Completed');

    // Filter to user-selected subset
    if (Array.isArray(pendingTasks)) {
      tasks = tasks.filter(t => pendingTasks.includes(t.id));
    }

    try {
      const rescue = await runEmergencyRescue(
        tasks,
        [], // Omit full calendar events to strictly use selections
        [], // Omit habits to strictly use selections
        Number(availableHours),
        Array.isArray(meetings) ? meetings : [],
        Array.isArray(deadlines) ? deadlines : []
      );
      const criticalTasks = tasks.filter(t => t.deadlineRisk > 60).map(t => t.id);
      const optionalTasks = tasks.filter(t => t.deadlineRisk <= 60).map(t => t.id);
      const recommendedOrder = rescue.immediateSchedule.map(item => item.referenceId || item.title);
      const estimatedSuccess = Math.max(0, 100 - rescue.immediateSchedule.length * 5);
      const estimatedRisk = Math.min(100, (100 - estimatedSuccess) + rescue.immediateSchedule.length * 3);

      const recoveryPlan: Omit<RecoveryPlan, 'id' | 'createdAt'> = {
        userId,
        availableHours: Number(availableHours),
        pendingTasks: pendingTasks || tasks.map(t => t.id),
        deadlines: deadlines || tasks.map(t => t.deadline),
        meetings: meetings || db.calendarEvents.map(e => e.title),
        plan: rescue.plan,
        schedule: rescue.immediateSchedule.map((item, idx) => ({
          ...item,
          id: `rp-item-${Date.now()}-${idx}`
        })),
        completionProbability: rescue.immediateSchedule.length ? Math.max(0, 100 - rescue.immediateSchedule.length * 10) : 50,
        criticalTasks,
        optionalTasks,
        recommendedOrder,
        estimatedSuccess,
        estimatedRisk
      };

      saveRecoveryPlan(db, userId, recoveryPlan);
      createNotification(db, userId, 'Recovery plan created', 'An emergency rescue schedule has been generated to help you recover your workday.', 'warning');
      writeDb(db);

      return res.json({ success: true, ...recoveryPlan });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI rescue plan failed." });
    }
  });

  app.get("/api/ai/consistency", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const tasks = db.tasks.filter((t: Task) => t.userId === userId);
    const habits = db.habits.filter((h: Habit) => h.userId === userId);
    const analytics = db.analytics.filter((a: Analytic) => a.userId === userId);

    try {
      const metrics = await computeConsistencyMetrics(tasks, habits, analytics);
      saveConsistencySnapshot(db, userId, metrics);
      writeDb(db);
      return res.json(metrics);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "AI consistency computation failed." });
    }
  });

  app.get("/api/goals", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const goals = db.goals.filter((g: Goal) => g.userId === userId);
    const milestones = db.milestones.filter((m: Milestone) => m.userId === userId);
    return res.json({ goals, milestones });
  });

  app.post("/api/goals", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, milestones, projectId, teamId, organizationId } = req.body;
    if (!title) return res.status(400).json({ error: "Goal title is required." });

    const db = readDb();
    const newGoal: Goal = {
      id: `g-${Date.now()}`,
      userId,
      title,
      description: description || "",
      status: 'Active',
      progress: 0,
      projectId,
      teamId,
      organizationId,
      createdAt: new Date().toISOString()
    };

    db.goals.push(newGoal);

    const milestoneRecords: Milestone[] = Array.isArray(milestones) ? milestones.map((m: any, index: number) => ({
      id: `m-${Date.now()}-${index}`,
      userId,
      goalId: newGoal.id,
      title: m.title || `Milestone ${index + 1}`,
      description: m.description || '',
      taskIds: Array.isArray(m.taskIds) ? m.taskIds : [],
      status: m.status || 'Pending',
      createdAt: new Date().toISOString()
    })) : [];
    db.milestones.push(...milestoneRecords);

    const tasks = db.tasks.filter((t: Task) => t.userId === userId);
    const plan = await createGoalPlan(newGoal, milestoneRecords, tasks);

    // Persist the recommended task mappings
    if (plan.recommendedTaskMap) {
      Object.entries(plan.recommendedTaskMap).forEach(([mId, tIds]) => {
        tIds.forEach(tId => {
          const tIdx = db.tasks.findIndex(t => t.id === tId && t.userId === userId);
          if (tIdx > -1) {
            db.tasks[tIdx].goalId = newGoal.id;
            db.tasks[tIdx].milestoneId = mId;
          }
        });
      });
    }

    writeDb(db);
    emitWorkspaceEvent('workspace:goal-created', { goal: newGoal, milestones: milestoneRecords }, getTargetRooms({ userId, projectId: newGoal.projectId, teamId: newGoal.teamId, organizationId: newGoal.organizationId }));
    sendNotification(db, userId, 'Goal created', `Goal “${newGoal.title}” has been added to your roadmap.`, 'success');
    return res.json({ goal: newGoal, milestones: milestoneRecords, recommendedTaskMap: plan.recommendedTaskMap });
  });

  app.put("/api/goals/:id", async (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const goalId = req.params.id;
    const { title, description, status, milestones } = req.body;
    const db = readDb();
    const goalIdx = db.goals.findIndex((g: Goal) => g.id === goalId && g.userId === userId);
    if (goalIdx === -1) return res.status(404).json({ error: "Goal not found." });

    const updatedGoal = { ...db.goals[goalIdx], title: title || db.goals[goalIdx].title, description: description ?? db.goals[goalIdx].description, status: status || db.goals[goalIdx].status };
    db.goals[goalIdx] = updatedGoal;

    if (Array.isArray(milestones)) {
      db.milestones = db.milestones.filter((m: Milestone) => m.goalId !== goalId);
      const milestoneRecords: Milestone[] = milestones.map((m: any, index: number) => ({
        id: m.id || `m-${Date.now()}-${index}`,
        userId,
        goalId,
        title: m.title || `Milestone ${index + 1}`,
        description: m.description || '',
        taskIds: Array.isArray(m.taskIds) ? m.taskIds : [],
        status: m.status || 'Pending',
        createdAt: m.createdAt || new Date().toISOString()
      }));
      db.milestones.push(...milestoneRecords);
    }

    const tasks = db.tasks.filter((t: Task) => t.userId === userId);
    const updatedMilestones = db.milestones.filter((m: Milestone) => m.goalId === goalId);
    const plan = await createGoalPlan(updatedGoal, updatedMilestones, tasks);

    // Update task mappings
    if (plan.recommendedTaskMap) {
      Object.entries(plan.recommendedTaskMap).forEach(([mId, tIds]) => {
        tIds.forEach(tId => {
          const tIdx = db.tasks.findIndex(t => t.id === tId && t.userId === userId);
          if (tIdx > -1) {
            db.tasks[tIdx].goalId = goalId;
            db.tasks[tIdx].milestoneId = mId;
          }
        });
      });
    }

    createActivityLog(db, userId, 'Updated goal', `Goal “${updatedGoal.title}” updated`, updatedGoal.organizationId, updatedGoal.teamId, updatedGoal.projectId);
    writeDb(db);
    emitWorkspaceEvent('workspace:goal-updated', { goal: updatedGoal, milestones: updatedMilestones }, getTargetRooms({ userId, projectId: updatedGoal.projectId, teamId: updatedGoal.teamId, organizationId: updatedGoal.organizationId }));
    sendNotification(db, userId, 'Goal updated', `Goal “${updatedGoal.title}” has been updated.`, 'info');
    return res.json({ goal: updatedGoal, milestones: updatedMilestones, recommendedTaskMap: plan.recommendedTaskMap });
  });

  app.delete("/api/goals/:id", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const goalId = req.params.id;
    const db = readDb();
    const goal = db.goals.find((g: Goal) => g.id === goalId && g.userId === userId);
    if (!goal) return res.status(404).json({ error: "Goal not found." });

    db.goals = db.goals.filter((g: Goal) => g.id !== goalId);
    db.milestones = db.milestones.filter((m: Milestone) => m.goalId !== goalId);

    // Clean up task references
    db.tasks.forEach((t: Task) => {
      if (t.goalId === goalId) {
        t.goalId = undefined;
        t.milestoneId = undefined;
      }
    });

    createActivityLog(db, userId, 'Deleted goal', `Removed goal ${goal.title}`, goal.organizationId, goal.teamId, goal.projectId);
    writeDb(db);
    emitWorkspaceEvent('workspace:goal-deleted', { goalId, userId }, [
      goal.organizationId ? `org-${goal.organizationId}` : '',
      goal.teamId ? `team-${goal.teamId}` : '',
      goal.projectId ? `project-${goal.projectId}` : ''
    ].filter(Boolean));
    return res.json({ success: true });
  });

  // ==========================================================
  // WORKSPACE & COLLABORATION ENDPOINTS
  // ==========================================================

  app.get("/api/workspace/organizations", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const organizations = db.organizations.filter((org: Organization) => org.memberIds.includes(userId));
    return res.json(organizations);
  });

  app.get("/api/workspace/organizations/:id", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const organization = db.organizations.find((org: Organization) => org.id === req.params.id);
    if (!organization || !organization.memberIds.includes(userId)) {
      return res.status(404).json({ error: "Organization not found or access denied." });
    }

    const teams = db.teams.filter((team: Team) => team.organizationId === organization.id);
    const projects = db.projects.filter((project: Project) => project.organizationId === organization.id);
    return res.json({ ...organization, teams, projects });
  });

  app.post("/api/workspace/organizations", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Organization name is required." });

    const db = readDb();
    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name,
      description: description || "Collaborative workspace organization.",
      ownerId: userId,
      memberIds: [userId],
      teamIds: [],
      projectIds: [],
      createdAt: new Date().toISOString()
    };

    db.organizations.push(newOrg);
    const user = db.users.find((user: User) => user.id === userId);
    if (user) {
      user.organizationIds = Array.from(new Set([...(user.organizationIds || []), newOrg.id]));
    }

    createActivityLog(db, userId, 'Created organization', `Organization ${name} created`, newOrg.id);
    writeDb(db);
    emitWorkspaceEvent('workspace:organization-created', { organization: newOrg }, [`org-${newOrg.id}`]);
    return res.json(newOrg);
  });

  app.get("/api/workspace/teams", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const teams = db.teams.filter((team: Team) => team.memberIds.includes(userId));
    return res.json(teams);
  });

  app.post("/api/workspace/teams", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { organizationId, name, description } = req.body;
    if (!organizationId || !name) return res.status(400).json({ error: "organizationId and team name are required." });

    const db = readDb();
    const organization = db.organizations.find((org: Organization) => org.id === organizationId);
    if (!organization || !organization.memberIds.includes(userId)) {
      return res.status(404).json({ error: "Organization not found or access denied." });
    }

    const newTeam: Team = {
      id: `team-${Date.now()}`,
      organizationId,
      name,
      description: description || "New team workspace.",
      memberIds: [userId],
      projectIds: [],
      createdAt: new Date().toISOString()
    };

    db.teams.push(newTeam);
    organization.teamIds.push(newTeam.id);

    const user = db.users.find((user: User) => user.id === userId);
    if (user) {
      user.teamIds = Array.from(new Set([...(user.teamIds || []), newTeam.id]));
    }

    createActivityLog(db, userId, 'Created team', `Team ${name} created in organization ${organization.name}`, organization.id, newTeam.id);
    writeDb(db);
    emitWorkspaceEvent('workspace:team-created', { team: newTeam }, [`org-${organization.id}`, `team-${newTeam.id}`]);
    return res.json(newTeam);
  });

  app.get("/api/workspace/projects", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const projects = db.projects.filter((project: Project) => project.memberIds.includes(userId));
    return res.json(projects);
  });

  app.post("/api/workspace/projects", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { organizationId, teamId, title, description } = req.body;
    if (!organizationId || !title) return res.status(400).json({ error: "organizationId and project title are required." });

    const db = readDb();
    const organization = db.organizations.find((org: Organization) => org.id === organizationId);
    if (!organization || !organization.memberIds.includes(userId)) {
      return res.status(404).json({ error: "Organization not found or access denied." });
    }

    const team = teamId ? db.teams.find((team: Team) => team.id === teamId && team.organizationId === organizationId) : undefined;
    if (teamId && !team) {
      return res.status(404).json({ error: "Team not found in the selected organization." });
    }

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      organizationId,
      teamId,
      title,
      description: description || "Collaborative project plan.",
      ownerId: userId,
      managerId: userId,
      memberIds: [userId],
      goalIds: [],
      milestoneIds: [],
      taskIds: [],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Active',
      progress: 0,
      riskScore: 18,
      burnoutRisk: 10,
      capacityScore: 85,
      healthScore: 92,
      tags: ['team', 'collaboration'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.projects.push(newProject);
    organization.projectIds.push(newProject.id);
    if (team) {
      team.projectIds.push(newProject.id);
    }

    const user = db.users.find((user: User) => user.id === userId);
    if (user) {
      user.organizationIds = Array.from(new Set([...(user.organizationIds || []), organizationId]));
      user.teamIds = Array.from(new Set([...(user.teamIds || []), ...(teamId ? [teamId] : [])]));
      user.projectIds = Array.from(new Set([...(user.projectIds || []), newProject.id]));
    }

    createActivityLog(db, userId, 'Created project', `Project ${title} created`, organizationId, teamId, newProject.id);
    writeDb(db);
    emitWorkspaceEvent('workspace:project-created', { project: newProject }, [`org-${organizationId}`, ...(team ? [`team-${teamId}`] : []), `project-${newProject.id}`].filter(Boolean));
    return res.json(newProject);
  });

  app.get("/api/workspace/activity", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const user = db.users.find((u: User) => u.id === userId);
    const orgIds = user?.organizationIds || [];
    const teamIds = user?.teamIds || [];
    const projectIds = db.projects.filter((p: Project) => p.memberIds.includes(userId)).map(p => p.id);

    const activity = db.activityLogs.filter((entry: ActivityLog) =>
      entry.userId === userId ||
      (entry.organizationId && orgIds.includes(entry.organizationId)) ||
      (entry.teamId && teamIds.includes(entry.teamId)) ||
      (entry.projectId && projectIds.includes(entry.projectId))
    ).sort((a: ActivityLog, b: ActivityLog) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json(activity.slice(0, 50));
  });

  app.get("/api/workspace/members", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const memberIds = new Set<string>([userId]);
    db.organizations.filter(org => org.memberIds.includes(userId)).forEach(org => org.memberIds.forEach((id) => memberIds.add(id)));
    db.teams.filter(team => team.memberIds.includes(userId)).forEach(team => team.memberIds.forEach((id) => memberIds.add(id)));
    db.projects.filter(project => project.memberIds.includes(userId)).forEach(project => project.memberIds.forEach((id) => memberIds.add(id)));

    const members = db.users
      .filter((u: User) => memberIds.has(u.id))
      .map((u: User) => ({
        ...u,
        presence: presenceMap[u.id] || {
          userId: u.id,
          workspaceId: 'workspace-global',
          status: 'offline',
          lastActiveAt: new Date(0).toISOString()
        }
      }));

    return res.json(members);
  });

  app.get("/api/workspace/team-summary", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const teams = db.teams.filter((t: Team) => t.memberIds.includes(userId));
    const summaries = teams.map((team) => {
      const teamMembers = team.memberIds.map((memberId) => db.users.find((u: User) => u.id === memberId)).filter(Boolean) as User[];
      const teamTasks = db.tasks.filter((task: Task) => team.memberIds.includes(task.userId));
      const activeTasks = teamTasks.filter((task: Task) => task.status !== 'Completed');
      const overdueTasks = activeTasks.filter((task: Task) => new Date(task.deadline) < new Date());
      const avgProductivity = teamMembers.length ? Math.round(teamMembers.reduce((sum, user) => sum + (user.productivityScore || 0), 0) / teamMembers.length) : 50;
      const completionCount = teamTasks.filter((task: Task) => task.status === 'Completed').length;
      const completionRate = teamTasks.length ? Math.round((completionCount / teamTasks.length) * 100) : 0;
      const workloadByMember = teamMembers.map((member) => teamTasks.filter((task) => task.userId === member.id && task.status !== 'Completed').length);
      const avgWorkload = workloadByMember.length ? workloadByMember.reduce((sum, count) => sum + count, 0) / workloadByMember.length : 0;
      const workloadVariance = workloadByMember.length ? Math.round(workloadByMember.reduce((sum, count) => sum + Math.abs(count - avgWorkload), 0) / workloadByMember.length) : 0;

      return {
        teamId: team.id,
        name: team.name,
        organizationId: team.organizationId,
        healthScore: Math.max(0, 100 - workloadVariance - overdueTasks.length * 2),
        workloadBalanceScore: Math.max(0, 100 - workloadVariance * 5),
        activeTaskCount: activeTasks.length,
        overdueTaskCount: overdueTasks.length,
        engagementScore: Math.min(100, avgProductivity + completionRate / 2),
        averageProductivity: avgProductivity,
        completionRate,
        memberCount: team.memberIds.length
      };
    });

    const projects = db.projects.filter((project: Project) => project.memberIds.includes(userId)).map((project) => {
      const projectTasks = db.tasks.filter((task: Task) => task.projectId === project.id);
      const blockedTasks = projectTasks.filter((task: Task) => task.deadlineRisk > 60 && task.status !== 'Completed').length;
      const progress = project.progress || 0;
      const deadlineRisk = project.riskScore || 20;
      const burnout = project.burnoutRisk || 25;
      const dependencyPressure = projectTasks.filter((task) => (task.dependencyIds?.length || 0) > 0).length;
      return {
        projectId: project.id,
        title: project.title,
        progress,
        deadlineRisk,
        blockedTasks,
        burnoutRisk: burnout,
        dependencies: dependencyPressure,
        aiHealthScore: Math.max(0, 100 - deadlineRisk - burnout - blockedTasks * 2)
      };
    });

    return res.json({ teams: summaries, projects });
  });

  app.get("/api/workspace/daily-standup", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const teams = db.teams.filter((t: Team) => t.memberIds.includes(userId));
    const standups = teams.flatMap((team) => {
      return team.memberIds.map((memberId) => {
        const member = db.users.find((u: User) => u.id === memberId);
        if (!member) return null;
        const tasks = db.tasks.filter((task: Task) => task.userId === memberId);
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayCompleted = tasks.filter((task) => task.status === 'Completed' && new Date(task.updatedAt) >= yesterday).length;
        const todayPending = tasks.filter((task) => task.status !== 'Completed' && new Date(task.deadline) >= new Date()).length;
        const blocked = tasks.filter((task) => task.deadlineRisk > 65 && task.status === 'Pending');
        return {
          userId: memberId,
          name: member.name,
          yesterday: `Completed ${yesterdayCompleted} tasks and cleared priority items.`,
          today: `Working on ${todayPending} active tasks, including ${tasks.find((t) => t.status !== 'Completed')?.title || 'focus planning'}.`,
          blocked: blocked.length > 0 ? blocked.map((t) => t.title).join(', ') : 'No current blockers.',
          recommendations: blocked.length > 0 ? `Balance ${blocked.length} blocked tasks across the team to reduce drift.` : 'Keep the momentum going with current priorities.'
        };
      }).filter(Boolean);
    });

    return res.json(standups);
  });

  app.post("/api/workspace/ai/balance-team", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const teams = db.teams.filter((t: Team) => t.memberIds.includes(userId));
    if (teams.length === 0) {
      return res.status(400).json({ error: "No teams available for balancing." });
    }

    const team = teams[0];
    const members = team.memberIds.map((memberId) => db.users.find((u: User) => u.id === memberId)).filter(Boolean) as User[];
    const memberTaskCounts = members.map((member) => ({ member, count: db.tasks.filter((task: Task) => task.userId === member.id && task.status !== 'Completed').length }));
    const avgCount = memberTaskCounts.reduce((sum, item) => sum + item.count, 0) / Math.max(memberTaskCounts.length, 1);
    const overloaded = memberTaskCounts.find((item) => item.count > avgCount + 1);
    const idle = memberTaskCounts.find((item) => item.count < avgCount - 1);
    const candidateTask = overloaded ? db.tasks.filter((task: Task) => task.userId === overloaded.member.id && task.status !== 'Completed').sort((a, b) => b.deadlineRisk - a.deadlineRisk)[0] : null;

    if (!idle || !overloaded || !candidateTask) {
      return res.json({ recommendationId: `rb-${Date.now()}`, title: 'Team workload balanced', description: 'Your team is operating evenly. No reassignment needed right now.', affectedTeamId: team.id, affectedProjectId: team.projectIds[0], suggestedReallocation: [], confidenceScore: 82, createdAt: new Date().toISOString() });
    }

    const recommendation = {
      recommendationId: `rb-${Date.now()}`,
      title: 'Shift task ownership to balance workload',
      description: `${idle.member.name} has capacity while ${overloaded.member.name} is overloaded. Move a high-risk task to prevent burnout.`,
      affectedTeamId: team.id,
      affectedProjectId: candidateTask.projectId,
      suggestedReallocation: [
        {
          fromUserId: overloaded.member.id,
          toUserId: idle.member.id,
          taskId: candidateTask.id,
          reasoning: `Task has high deadline pressure and reassignment will reduce ${overloaded.member.name}'s load while improving completion odds.`
        }
      ],
      confidenceScore: Math.min(100, 70 + Math.round((overloaded.count - idle.count) * 5)),
      createdAt: new Date().toISOString()
    };

    emitWorkspaceEvent('workspace:ai-recommendation', recommendation, getTargetRooms({ userId, teamId: team.id, projectId: candidateTask?.projectId }));
    return res.json(recommendation);
  });

  app.post("/api/workspace/ai/balance-team/accept", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { taskId, toUserId } = req.body;
    if (!taskId || !toUserId) return res.status(400).json({ error: "taskId and toUserId are required." });

    const db = readDb();
    const task = db.tasks.find((t: Task) => t.id === taskId);
    if (!task) return res.status(404).json({ error: "Task not found." });

    const previousOwner = db.users.find((u: User) => u.id === task.userId);
    task.assignedToId = toUserId;
    task.updatedAt = new Date().toISOString();
    writeDb(db);

    if (previousOwner && previousOwner.id !== toUserId) {
      sendNotification(db, previousOwner.id, 'Task reassigned', `Task “${task.title}” was reassigned from you.`, 'info');
    }
    sendNotification(db, toUserId, 'New assignment', `You were assigned to task “${task.title}”.`, 'success');
    emitWorkspaceEvent('workspace:task-updated', { task }, getTargetRooms({ userId: toUserId, taskId: task.id, projectId: task.projectId, teamId: task.teamId, organizationId: task.organizationId }));

    return res.json({ success: true, task });
  });

  app.get("/api/workspace/comments", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const targetType = req.query.targetType as string;
    const targetId = req.query.targetId as string;
    if (!targetType || !targetId) {
      return res.status(400).json({ error: "targetType and targetId are required." });
    }

    const db = readDb();
    const comments = db.comments.filter((comment: Comment) => comment.targetType === targetType && comment.targetId === targetId);
    return res.json(comments);
  });

  app.post("/api/workspace/comments", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { targetType, targetId, content, parentId } = req.body;
    if (!targetType || !targetId || !content) {
      return res.status(400).json({ error: "targetType, targetId and content are required." });
    }

    const db = readDb();
    const newComment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetType,
      targetId,
      userId,
      content,
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.comments.push(newComment);
    createActivityLog(db, userId, `Commented on ${targetType}`, content, undefined, undefined, targetType === 'project' ? targetId : undefined);

    const mentionMatches = [...content.matchAll(/@([a-zA-Z0-9_\-\.]+)/g)].map((m) => m[1]);
    const mentionedUsers = db.users.filter((u: User) => mentionMatches.some(name => u.name.toLowerCase().includes(name.toLowerCase()) || u.email.toLowerCase().startsWith(name.toLowerCase())));
    mentionedUsers.forEach((mentioned) => {
      if (mentioned.id !== userId) {
        sendNotification(db, mentioned.id, 'Mentioned in comment', `${db.users.find(u => u.id === userId)?.name || 'A teammate'} mentioned you in a ${targetType} comment.`, 'info');
      }
    });

    writeDb(db);
    const rooms = [
      targetType === 'project' ? `project-${targetId}` : null,
      targetType === 'task' ? `task-${targetId}` : null,
      `workspace-global`
    ].filter(Boolean) as string[];
    emitWorkspaceEvent('workspace:comment-created', { comment: newComment, targetType, targetId }, rooms);
    return res.json(newComment);
  });

  app.get("/api/workspace/reactions", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const targetType = req.query.targetType as string;
    const targetId = req.query.targetId as string;
    if (!targetType || !targetId) {
      return res.status(400).json({ error: "targetType and targetId are required." });
    }

    const db = readDb();
    const reactions = db.reactions.filter((reaction: Reaction) => reaction.targetType === targetType && reaction.targetId === targetId);
    return res.json(reactions);
  });

  app.post("/api/workspace/reactions", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { targetType, targetId, emoji } = req.body;
    if (!targetType || !targetId || !emoji) {
      return res.status(400).json({ error: "targetType, targetId and emoji are required." });
    }

    const db = readDb();
    const newReaction: Reaction = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetType,
      targetId,
      userId,
      emoji,
      createdAt: new Date().toISOString()
    };
    db.reactions.push(newReaction);
    createActivityLog(db, userId, `Reacted with ${emoji}`, `Reacted to ${targetType} ${targetId}`, undefined, undefined, targetType === 'project' ? targetId : undefined);
    writeDb(db);
    const rooms = [
      targetType === 'project' ? `project-${targetId}` : null,
      targetType === 'task' ? `task-${targetId}` : null,
      `workspace-global`
    ].filter(Boolean) as string[];
    emitWorkspaceEvent('workspace:reaction-created', { reaction: newReaction, targetType, targetId }, rooms);
    if (targetType === 'task') {
      const targetTask = db.tasks.find((t: Task) => t.id === targetId);
      if (targetTask && targetTask.userId !== userId) {
        sendNotification(db, targetTask.userId, 'Task reaction', `${db.users.find(u => u.id === userId)?.name || 'A teammate'} reacted to your task.`, 'info');
      }
    }
    return res.json(newReaction);
  });

  app.get("/api/workspace/invitations", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const user = db.users.find((u: User) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const invitations = db.invitations.filter((inv: Invitation) => inv.email.toLowerCase() === user.email.toLowerCase());
    return res.json(invitations);
  });

  app.post("/api/workspace/invitations", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { organizationId, teamId, projectId, email, role } = req.body;
    if (!organizationId || !email || !role) return res.status(400).json({ error: "organizationId, email, and role are required." });

    const db = readDb();
    const organization = db.organizations.find((org: Organization) => org.id === organizationId);
    if (!organization || !organization.memberIds.includes(userId)) {
      return res.status(404).json({ error: "Organization not found or access denied." });
    }

    const newInvite: Invitation = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId,
      teamId,
      projectId,
      email,
      senderId: userId,
      role,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    db.invitations.push(newInvite);
    createActivityLog(db, userId, 'Sent invitation', `Invited ${email} to ${organization.name}`, organizationId, teamId, projectId);
    writeDb(db);
    return res.json(newInvite);
  });

  app.get("/api/workspace/workload/recommendations", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const db = readDb();
    const recommendations = db.workloadRecommendations.filter((rec: WorkloadRecommendation) => rec.recommendedToUserId === userId || rec.recommendedFromUserId === userId);
    return res.json(recommendations);
  });

  app.post("/api/workspace/workload/recommendations", (req, res) => {
    const userId = getAuthorizedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { recommendedToUserId, taskId, reason } = req.body;
    if (!recommendedToUserId || !taskId || !reason) {
      return res.status(400).json({ error: "recommendedToUserId, taskId and reason are required." });
    }

    const db = readDb();
    const recommendation: WorkloadRecommendation = {
      id: `wr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      recommendedFromUserId: userId,
      recommendedToUserId,
      taskId,
      reason,
      estimatedCompletionIncrease: 10,
      createdAt: new Date().toISOString()
    };
    db.workloadRecommendations.push(recommendation);
    createActivityLog(db, userId, 'Created workload recommendation', reason);
    writeDb(db);
    emitWorkspaceEvent('workspace:workload-recommendation', { recommendation }, [`user-${recommendedToUserId}`]);
    return res.json(recommendation);
  });

  // ==========================================================
  // VITE DEVELOPMENT MIDDLEWARE / PRODUCTION STATIC SERVING
  // ==========================================================
  
  const httpServer = http.createServer(app);
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  let viteInstance: any = null;

  if (process.env.DISABLE_HMR === "true") {
    console.log("File watching disabled to save CPU resources.");
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    viteInstance = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static file assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  io.on("connection", (socket) => {
    console.log("Socket connected", socket.id);

    let connectedUserId: string | null = null;
    const authToken = socket.handshake.auth?.token;
    if (authToken) {
      if (authToken === "demo-token-last-minute-life-saver") {
        connectedUserId = "demo-user-001";
        socket.join(`user-${connectedUserId}`);
        socket.join(`workspace-global`);
        broadcastPresenceUpdate(connectedUserId, 'online');
      } else {
        try {
          const decoded = jwt.verify(authToken, JWT_SECRET) as any;
          if (decoded?.id) {
            connectedUserId = decoded.id;
            socket.join(`user-${connectedUserId}`);
            socket.join(`workspace-global`);
            broadcastPresenceUpdate(connectedUserId, 'online');
          }
        } catch (err) {
          console.warn("Socket auth failed", err);
        }
      }
    }

    socket.on("joinRoom", ({ room }) => {
      if (room) {
        socket.join(room);
      }
    });

    socket.on("leaveRoom", ({ room }) => {
      if (room) {
        socket.leave(room);
      }
    });

    socket.on("typing:start", ({ targetType, targetId, userName }) => {
      if (connectedUserId) {
        broadcastPresenceUpdate(connectedUserId, 'typing');
      }
      const payload = { targetType, targetId, userName, userId: connectedUserId, timestamp: new Date().toISOString() };
      io?.to(`workspace-global`).emit("workspace:typing", payload);
      if (targetId) {
        io?.to(`task-${targetId}`).emit("workspace:typing", payload);
      }
    });

    socket.on("typing:stop", ({ targetType, targetId, userName }) => {
      if (connectedUserId) {
        broadcastPresenceUpdate(connectedUserId, 'online');
      }
      const payload = { targetType, targetId, userName, userId: connectedUserId, timestamp: new Date().toISOString() };
      io?.to(`workspace-global`).emit("workspace:typing", payload);
      if (targetId) {
        io?.to(`task-${targetId}`).emit("workspace:typing", payload);
      }
    });

    socket.on("presence:set", ({ status }) => {
      if (connectedUserId && status) {
        broadcastPresenceUpdate(connectedUserId, status);
      }
    });

    socket.on("workspaceMessage", (payload) => {
      if (payload?.room) {
        io?.to(payload.room).emit("workspaceMessage", payload);
      }
    });

    socket.on("disconnect", () => {
      if (connectedUserId) {
        broadcastPresenceUpdate(connectedUserId, 'offline');
      }
      console.log("Socket disconnected", socket.id);
    });
  });

  const server = httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`==========================================================`);
    console.log(`Last-Minute Life Saver Full-Stack Running on port ${PORT}`);
    console.log(`Access Local Dev Environment via Develop App URL`);
    console.log(`==========================================================`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${PORT} is already in use. Please terminate the existing process or use a different port.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });

  // Handle graceful shutdown to release ports
  const shutdown = async () => {
    console.log("Shutting down server...");

    try {
      // 1. Close Socket.IO
      if (io) {
        console.log("Closing Socket.IO...");
        io.close();
      }

      // 2. Close Vite (stops file watchers)
      if (viteInstance) {
        console.log("Closing Vite instance...");
        await viteInstance.close();
      }

      // 3. Close HTTP Server
      if (server.closeAllConnections) {
        console.log("Closing all active HTTP connections...");
        server.closeAllConnections();
      }

      server.close(() => {
        console.log("HTTP Server closed.");
        process.exit(0);
      });

      // Force exit after 2 seconds if graceful shutdown fails
      setTimeout(() => {
        console.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
      }, 2000);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown());
  process.on('SIGINT', () => shutdown());
  process.on('SIGQUIT', () => shutdown());

  return { app, httpServer, io };
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { startServer };

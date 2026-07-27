import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readDb, writeDb, seedUserData } from '../db';
import { JWT_SECRET, JWT_REFRESH_SECRET, getAuthorizedUserId } from '../middleware/auth';
import { User, Organization, Team, Project } from '../../src/types';

const router = Router();

const toPublicUser = (user: any) => {
  if (!user) return null;
  const { password, refreshTokens, ...publicUser } = user;
  return publicUser;
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

/**
 * Demo Mode Init Endpoint
 * Host: GET /api/demo/init
 */
router.get('/demo/init', (req: Request, res: Response) => {
  const db = readDb();
  let demoUser = db.users.find(u => u.id === 'demo-user-001');
  if (!demoUser) {
    demoUser = {
      id: 'demo-user-001',
      email: 'demo@example.com',
      name: 'Demo User',
      productivityScore: 87,
      theme: 'dark',
      workHoursStart: '09:00',
      workHoursEnd: '18:00',
      focusPeriod: 25,
      streakCount: 14,
      role: 'user',
      googleCalendarLinked: false,
      organizationIds: ['org-demo-001'],
      teamIds: ['team-demo-001'],
      projectIds: ['proj-demo-001'],
      skills: ['Planning', 'Focus', 'Time Management'],
      currentWorkload: 72,
      active: true,
      refreshTokens: []
    };

    createOrganizationForUser(db, demoUser);
    db.users.push(demoUser);
    writeDb(db);
    seedUserData(demoUser.id);
  }

  return res.json({ success: true, user: toPublicUser(demoUser) });
});

/**
 * Signup Endpoint
 * Host: POST /api/auth/signup
 */
router.post('/auth/signup', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const db = readDb();
  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists with this email address.' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser: User = {
    id: `u-${Date.now()}`,
    email: email.toLowerCase(),
    name,
    productivityScore: 82,
    theme: 'dark',
    workHoursStart: '09:00',
    workHoursEnd: '18:00',
    focusPeriod: 25,
    streakCount: 1,
    password: hashedPassword,
    role: 'user',
    refreshTokens: []
  };

  const accessToken = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const refreshToken = jwt.sign(
    { id: newUser.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  newUser.refreshTokens = [refreshToken];

  createOrganizationForUser(db, newUser);
  db.users.push(newUser);
  writeDb(db);
  seedUserData(newUser.id);

  return res.json({ token: accessToken, refreshToken, user: toPublicUser(newUser) });
});

/**
 * Login Endpoint
 * Host: POST /api/auth/login
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Sandbox auto-create mode if user does not exist
    if (!password) {
      return res.status(400).json({ error: 'Password is required to create your account.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const defaultName = email.split('@')[0];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: `u-${Date.now()}`,
      email: email.toLowerCase(),
      name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
      productivityScore: 85,
      theme: 'dark',
      workHoursStart: '09:00',
      workHoursEnd: '18:00',
      focusPeriod: 25,
      streakCount: 3,
      password: hashedPassword,
      role: 'user',
      refreshTokens: []
    };

    const accessToken = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const refreshToken = jwt.sign(
      { id: newUser.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    newUser.refreshTokens = [refreshToken];

    createOrganizationForUser(db, newUser);
    db.users.push(newUser);
    writeDb(db);
    seedUserData(newUser.id);

    return res.json({ token: accessToken, refreshToken, user: toPublicUser(newUser) });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (!user.password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
    user.role = 'user';
  } else {
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password. Please check your credentials.' });
    }
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  if (!user.refreshTokens) {
    user.refreshTokens = [];
  }
  user.refreshTokens.push(refreshToken);

  if (user.refreshTokens.length > 5) {
    user.refreshTokens.shift();
  }

  writeDb(db);

  return res.json({ token: accessToken, refreshToken, user: toPublicUser(user) });
});

/**
 * Token Refresh Endpoint
 * Host: POST /api/auth/refresh
 */
router.post('/auth/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const db = readDb();
    const user = db.users.find(u => u.id === decoded.id);

    if (!user || !user.refreshTokens || !user.refreshTokens.includes(refreshToken)) {
      return res.status(403).json({ error: 'Invalid refresh token or session expired.' });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({ token: accessToken, refreshToken });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired refresh token.' });
  }
});

/**
 * Logout Endpoint
 * Host: POST /api/auth/logout
 */
router.post('/auth/logout', (req: Request, res: Response) => {
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
      // Ignore
    }
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Forgot Password Endpoint
 * Host: POST /api/auth/forgot-password
 */
router.post('/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  return res.json({ message: `If an account exists for ${email}, a password reset link will be sent.` });
});

/**
 * Fetch Current User Profile
 * Host: GET /api/auth/me or GET /api/users/me
 */
router.get('/auth/me', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  return res.json(toPublicUser(user));
});

router.get('/users/me', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  return res.json(toPublicUser(user));
});

/**
 * Update Current Profile & Settings
 * Host: PUT /api/auth/me or PUT /api/users/me
 */
router.put('/auth/me', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const userIdx = db.users.findIndex(u => u.id === userId);
  if (userIdx === -1) return res.status(404).json({ error: 'User not found.' });

  const safeUpdates = sanitizeProfileUpdate(req.body || {});
  const updatedUser = {
    ...db.users[userIdx],
    ...safeUpdates
  };

  db.users[userIdx] = updatedUser;
  writeDb(db);

  return res.json(toPublicUser(updatedUser));
});

export default router;

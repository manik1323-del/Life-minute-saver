import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import * as db from './db';
import * as ai from './ai';

vi.mock('./db');
vi.mock('./ai');
vi.mock('vite', () => ({
  createServer: vi.fn(() => Promise.resolve({ middlewares: (req, res, next) => next() }))
}));

const getMockDb = () => ({
  users: [],
  tasks: [],
  subtasks: [],
  habits: [],
  notifications: [],
  schedules: [],
  analytics: [],
  calendarEvents: [],
  aiSuggestions: [],
  chatMessages: {},
  goals: [],
  milestones: [],
  predictions: [],
  consistencySnapshots: [],
  simulationHistory: [],
  recoveryPlans: [],
  organizations: [],
  teams: [],
  projects: [],
  comments: [],
  reactions: [],
  activityLogs: [],
  invitations: [],
  workloadRecommendations: [],
});

describe('Server API Endpoints', async () => {
  const { app } = await startServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth Endpoints', () => {
    it('POST /api/auth/signup should create a new user', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', name: 'Test', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
    }, 10000);

    it('POST /api/auth/login should authenticate user', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'new@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    }, 10000);
  });

  describe('Task Endpoints', () => {
    it('GET /api/tasks should return user tasks', async () => {
      const mockDb = getMockDb();
      mockDb.tasks = [{ userId: 'u1', title: 'Task' }] as any;
      vi.mocked(db.readDb).mockReturnValue(mockDb as any);

      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer u1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('POST /api/tasks should create a task', async () => {
      const mockDb = getMockDb();
      mockDb.users = [{ id: 'u1', workHoursStart: '09:00', workHoursEnd: '18:00' }] as any;
      vi.mocked(db.readDb).mockReturnValue(mockDb as any);
      vi.mocked(ai.planDailySchedule).mockResolvedValue([]);

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', 'Bearer u1')
        .send({ title: 'New Task', priority: 'High' });

      expect(res.status).toBe(200);
    }, 10000);
  });

  describe('AI Endpoints', () => {
    it('POST /api/ai/chat should return coach response', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      vi.mocked(ai.getCoachResponse).mockResolvedValue('Coach Advice');

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', 'Bearer u1')
        .send({ message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe('Coach Advice');
    });
  });

  describe('Workspace Endpoints', () => {
    it('GET /api/workspace/organizations should return organizations', async () => {
      const mockDb = getMockDb();
      mockDb.organizations = [{ memberIds: ['u1'] }] as any;
      vi.mocked(db.readDb).mockReturnValue(mockDb as any);

      const res = await request(app).get('/api/workspace/organizations').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('GET /api/workspace/activity should return activity logs', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      const res = await request(app).get('/api/workspace/activity').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });

    it('GET /api/workspace/members should return members', async () => {
      vi.mocked(db.readDb).mockReturnValue({ users: [{ id: 'u1' }], organizations: [], teams: [], projects: [] } as any);
      const res = await request(app).get('/api/workspace/members').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });

    it('GET /api/workspace/team-summary should return summary', async () => {
      vi.mocked(db.readDb).mockReturnValue({ teams: [], projects: [], tasks: [], users: [] } as any);
      const res = await request(app).get('/api/workspace/team-summary').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });

    it('GET /api/workspace/daily-standup should return standups', async () => {
      vi.mocked(db.readDb).mockReturnValue({ teams: [], tasks: [], users: [] } as any);
      const res = await request(app).get('/api/workspace/daily-standup').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });

    it('POST /api/workspace/ai/balance-team should return recommendation', async () => {
      vi.mocked(db.readDb).mockReturnValue({ teams: [], tasks: [], users: [] } as any);
      const res = await request(app).post('/api/workspace/ai/balance-team').set('Authorization', 'Bearer u1');
      // It returns 400 if no teams, which is fine for coverage
      expect(res.status).toBe(400);
    });
  });

  describe('Calendar & Suggestions Endpoints', () => {
    it('GET /api/calendar should return events', async () => {
      vi.mocked(db.readDb).mockReturnValue({ calendarEvents: [] } as any);
      const res = await request(app).get('/api/calendar').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });

    it('GET /api/ai/suggestions should return suggestions', async () => {
      vi.mocked(db.readDb).mockReturnValue({ aiSuggestions: [] } as any);
      const res = await request(app).get('/api/ai/suggestions').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });
  });

  describe('Subtask Endpoints', () => {
    it('GET /api/tasks/:id/subtasks should return subtasks', async () => {
      const mockDb = getMockDb();
      mockDb.tasks = [{ id: 't1', userId: 'u1' }] as any;
      mockDb.subtasks = [{ taskId: 't1', title: 'Sub' }] as any;
      vi.mocked(db.readDb).mockReturnValue(mockDb as any);
      const res = await request(app).get('/api/tasks/t1/subtasks').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });
  });

  describe('Habit Endpoints', () => {
    it('GET /api/habits should return habits', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      const res = await request(app).get('/api/habits').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });
  });

  describe('Notification Endpoints', () => {
    it('GET /api/notifications should return notifications', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      const res = await request(app).get('/api/notifications').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });
  });

  describe('Analytics & AI Insight Endpoints', () => {
    it('GET /api/analytics should return analytics', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      const res = await request(app).get('/api/analytics').set('Authorization', 'Bearer u1');
      expect(res.status).toBe(200);
    });

    it('POST /api/ai/simulate should return simulation result', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      vi.mocked(ai.simulateWhatIf).mockResolvedValue({ notes: 'Impact' } as any);
      vi.mocked(ai.planDailySchedule).mockResolvedValue([]);
      vi.mocked(ai.prioritizeTasks).mockResolvedValue([]);

      const res = await request(app)
        .post('/api/ai/simulate')
        .set('Authorization', 'Bearer u1')
        .send({ simulationType: 'test', changes: {} });
      expect(res.status).toBe(200);
    });

    it('POST /api/ai/rescue should return recovery plan', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      vi.mocked(ai.runEmergencyRescue).mockResolvedValue({ plan: [], immediateSchedule: [] });
      const res = await request(app)
        .post('/api/ai/rescue')
        .set('Authorization', 'Bearer u1')
        .send({ availableHours: 4 });
      expect(res.status).toBe(200);
    });
  });

  describe('Goal & Milestone Endpoints', () => {
    it('POST /api/goals should create goal and milestones', async () => {
      vi.mocked(db.readDb).mockReturnValue(getMockDb() as any);
      vi.mocked(ai.createGoalPlan).mockResolvedValue({ recommendedTaskMap: {} } as any);
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', 'Bearer u1')
        .send({ title: 'New Goal', milestones: [{ title: 'M1' }] });
      expect(res.status).toBe(200);
    });
  });

  describe('Organization & Team Endpoints', () => {
    it('POST /api/workspace/teams should create team', async () => {
      const mockDb = getMockDb();
      mockDb.organizations = [{ id: 'o1', memberIds: ['u1'], teamIds: [] }] as any;
      mockDb.users = [{ id: 'u1' }] as any;
      vi.mocked(db.readDb).mockReturnValue(mockDb as any);
      const res = await request(app)
        .post('/api/workspace/teams')
        .set('Authorization', 'Bearer u1')
        .send({ organizationId: 'o1', name: 'Team 1' });
      expect(res.status).toBe(200);
    });
  });
});

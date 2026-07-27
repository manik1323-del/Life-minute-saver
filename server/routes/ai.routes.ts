import { Router, Request, Response } from 'express';
import { getAuthorizedUserId } from '../middleware/auth.js';
import { readDb, writeDb } from '../db.js';
import {
  prioritizeTasks,
  generateSubtasks,
  planDailySchedule,
  getCoachResponse,
  generatePredictions,
  simulateWhatIf,
  createGoalPlan,
  runEmergencyRescue,
  computeConsistencyMetrics,
  analyzeAndEnhanceTask
} from '../ai.js';
import { Goal } from '../../src/types.js';

const router = Router();

/**
 * 1. AI Task Prioritization & Risk Model Endpoint
 * Host: POST /api/ai/prioritize
 */
router.post('/ai/prioritize', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const tasks = db.tasks.filter((t) => t.userId === userId && t.status !== 'Completed');
  const meetings = db.calendarEvents.filter((e) => e.userId === userId);

  try {
    const prioritized = await prioritizeTasks(tasks, meetings);
    
    // Update tasks in DB
    prioritized.forEach((item) => {
      const idx = db.tasks.findIndex((t) => t.id === item.id);
      if (idx !== -1) {
        db.tasks[idx].priority = item.priority || db.tasks[idx].priority;
        db.tasks[idx].priorityScore = item.priorityScore ?? db.tasks[idx].priorityScore;
        db.tasks[idx].deadlineRisk = item.deadlineRisk ?? db.tasks[idx].deadlineRisk;
      }
    });
    writeDb(db);

    return res.json({ success: true, prioritized });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI prioritization failed', details: err.message });
  }
});

/**
 * 2. AI Subtask Breakdown Model Endpoint
 * Host: POST /api/ai/subtasks
 */
router.post('/ai/subtasks', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required.' });

  try {
    const subtasks = await generateSubtasks(title, description || '');
    return res.json({ success: true, subtasks });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI subtask generation failed', details: err.message });
  }
});

/**
 * 3. AI Schedule Optimization Model Endpoint
 * Host: POST /api/ai/schedule
 */
router.post('/ai/schedule', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  const tasks = db.tasks.filter((t) => t.userId === userId && t.status !== 'Completed');
  const habits = db.habits.filter((h) => h.userId === userId);
  const meetings = db.calendarEvents.filter((e) => e.userId === userId);

  try {
    const scheduleItems = await planDailySchedule(
      tasks,
      habits,
      meetings,
      user?.workHoursStart || '09:00',
      user?.workHoursEnd || '18:00'
    );
    return res.json({ success: true, schedule: scheduleItems });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI schedule planning failed', details: err.message });
  }
});

/**
 * 4. AI Focus Coach Model Endpoint
 * Host: POST /api/ai/coach
 */
router.post('/ai/coach', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const db = readDb();
  const userTasks = db.tasks.filter((t) => t.userId === userId);
  const chatHistory = Array.isArray(history) ? history : (db.chatMessages[userId] || []);

  try {
    const reply = await getCoachResponse(chatHistory, message, userTasks);
    return res.json({ success: true, reply });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI Coach response failed', details: err.message });
  }
});

/**
 * 5. AI Delay Prediction Model Endpoint
 * Host: POST /api/ai/predict
 */
router.post('/ai/predict', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const tasks = db.tasks.filter((t) => t.userId === userId);
  const habits = db.habits.filter((h) => h.userId === userId);
  const meetings = db.calendarEvents.filter((e) => e.userId === userId);
  const userAnalytics = db.analytics.filter((a) => a.userId === userId);

  try {
    const predictions = await generatePredictions(tasks, habits, meetings);
    const consistency = await computeConsistencyMetrics(tasks, habits, userAnalytics);
    return res.json({ success: true, predictions, consistency });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI prediction model failed', details: err.message });
  }
});

/**
 * 6. AI What-If Simulation Model Endpoint
 * Host: POST /api/ai/simulate
 */
router.post('/ai/simulate', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { changes } = req.body;
  const db = readDb();
  const tasks = db.tasks.filter((t) => t.userId === userId);
  const habits = db.habits.filter((h) => h.userId === userId);
  const meetings = db.calendarEvents.filter((e) => e.userId === userId);

  try {
    const result = await simulateWhatIf(tasks, habits, meetings, changes || {});
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI simulation model failed', details: err.message });
  }
});

/**
 * 7. AI Emergency Rescue Model Endpoint
 * Host: POST /api/ai/rescue
 */
router.post('/ai/rescue', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { availableHours, extraMeetings, extraDeadlines } = req.body;
  const db = readDb();
  const tasks = db.tasks.filter((t) => t.userId === userId && t.status !== 'Completed');
  const habits = db.habits.filter((h) => h.userId === userId);
  const meetings = db.calendarEvents.filter((e) => e.userId === userId);

  try {
    const rescuePlan = await runEmergencyRescue(
      tasks,
      meetings,
      habits,
      Number(availableHours) || 4,
      Array.isArray(extraMeetings) ? extraMeetings : [],
      Array.isArray(extraDeadlines) ? extraDeadlines : []
    );
    return res.json({ success: true, rescuePlan });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI rescue plan failed', details: err.message });
  }
});

/**
 * 8. AI Goal Planning Model Endpoint
 * Host: POST /api/ai/goals/plan
 */
router.post('/ai/goals/plan', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { goalId, goalTitle } = req.body;
  const db = readDb();
  const userTasks = db.tasks.filter((t) => t.userId === userId);
  const userMilestones = db.milestones.filter((m) => m.userId === userId);

  const goal: Goal = db.goals.find((g) => g.id === goalId) || {
    id: goalId || `g-${Date.now()}`,
    userId,
    title: goalTitle || 'New Goal',
    description: '',
    progress: 0,
    status: 'Active',
    createdAt: new Date().toISOString(),
  };

  try {
    const goalPlan = await createGoalPlan(goal, userMilestones, userTasks);
    return res.json({ success: true, goalPlan });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI goal planning model failed', details: err.message });
  }
});

/**
 * 9. AI Task Enhancer Model Endpoint
 * Host: POST /api/ai/task/enhance
 */
router.post('/ai/task/enhance', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required.' });

  try {
    const enhanced = await analyzeAndEnhanceTask(title, description || '');
    return res.json({ success: true, enhancedTask: enhanced });
  } catch (err: any) {
    return res.status(500).json({ error: 'AI task enhancement failed', details: err.message });
  }
});

export default router;

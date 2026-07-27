import { Router, Request, Response } from 'express';
import { getAuthorizedUserId } from '../middleware/auth.js';
import { readDb, writeDb } from '../db.js';
import { Task, Subtask } from '../../src/types.js';

const router = Router();

const createActivityLog = (db: any, userId: string, action: string, detail: string, organizationId?: string, teamId?: string, projectId?: string) => {
  if (!db.activityLogs) db.activityLogs = [];
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

const createNotification = (db: any, userId: string, title: string, message: string, type: any = 'info') => {
  if (!db.notifications) db.notifications = [];
  const note = {
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

/**
 * Get User Tasks
 * Host: GET /api/tasks
 */
router.get('/tasks', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = readDb();
  const userTasks = db.tasks.filter((t) => t.userId === userId);
  return res.json(userTasks);
});

/**
 * Create New Task
 * Host: POST /api/tasks
 */
router.post('/tasks', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    title, description, deadline, priority, estimatedTime, category, tags,
    projectId, teamId, organizationId, difficulty, preferredWorkingTime,
    isRecurring, recurringFrequency, subtasks, estimatedEffort,
    aiSuggestedPriority, aiSuggestedTimeBlock
  } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  const db = readDb();
  const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  let progress = 0;
  const subtaskRecords: Subtask[] = [];

  if (Array.isArray(subtasks) && subtasks.length > 0) {
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
        weightage: Number(s.weightage) || Math.round(100 / subtasks.length),
        order: idx + 1
      });
    });
    db.subtasks.push(...subtaskRecords);
    progress = subtaskRecords.filter(s => s.completed).reduce((sum, s) => sum + s.weightage, 0);
  }

  const newTask: Task = {
    id: taskId,
    userId,
    title: title.trim(),
    description: description || '',
    deadline: deadline || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    priority: priority || 'Medium',
    status: progress === 100 ? 'Completed' : 'Pending',
    estimatedTime: Number(estimatedTime) || 60,
    category: category || 'Work',
    tags: Array.isArray(tags) ? tags : [],
    difficulty: difficulty || 'Medium',
    preferredWorkingTime,
    isRecurring: !!isRecurring,
    recurringFrequency,
    progress,
    priorityScore: priority === 'Critical' ? 90 : priority === 'High' ? 75 : 50,
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

  db.tasks.push(newTask);
  createActivityLog(db, userId, 'Created task', `Added task "${newTask.title}"`, organizationId, teamId, projectId);
  createNotification(db, userId, 'New Task Created', `Task "${newTask.title}" was added to your workflow.`, 'success');
  writeDb(db);

  return res.json(newTask);
});

/**
 * Update Task
 * Host: PUT /api/tasks/:id
 */
router.put('/tasks/:id', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const taskId = req.params.id;
  const db = readDb();
  const taskIdx = db.tasks.findIndex((t) => t.id === taskId && t.userId === userId);

  if (taskIdx === -1) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const updatedTask = {
    ...db.tasks[taskIdx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.tasks[taskIdx] = updatedTask;
  writeDb(db);

  return res.json(updatedTask);
});

/**
 * Update Task Status
 * Host: PATCH /api/tasks/:id/status
 */
router.patch('/tasks/:id/status', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const taskId = req.params.id;
  const { status } = req.body;
  const db = readDb();
  const taskIdx = db.tasks.findIndex((t) => t.id === taskId && t.userId === userId);

  if (taskIdx === -1) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  db.tasks[taskIdx].status = status;
  if (status === 'Completed') {
    db.tasks[taskIdx].progress = 100;
  }
  db.tasks[taskIdx].updatedAt = new Date().toISOString();

  writeDb(db);
  return res.json(db.tasks[taskIdx]);
});

/**
 * Delete Task
 * Host: DELETE /api/tasks/:id
 */
router.delete('/tasks/:id', (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const taskId = req.params.id;
  const db = readDb();
  const initialLength = db.tasks.length;

  db.tasks = db.tasks.filter((t) => !(t.id === taskId && t.userId === userId));
  db.subtasks = db.subtasks.filter((s) => s.taskId !== taskId);

  if (db.tasks.length === initialLength) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  writeDb(db);
  return res.json({ success: true, id: taskId });
});

export default router;

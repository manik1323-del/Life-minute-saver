import { Router, Request, Response } from 'express';
import { getAuthorizedUserId } from '../middleware/auth.js';
import { readDb, writeDb } from '../db.js';
import { supabase } from '../supabase.js';
import { Task, Subtask } from '../../src/types.js';

const router = Router();

function toSupabaseTask(task: Task) {
  return {
    id: task.id,
    user_id: task.userId,
    title: task.title,
    description: task.description || '',
    deadline: task.deadline || new Date().toISOString(),
    priority: task.priority || 'Medium',
    status: task.status || 'Pending',
    estimated_time: task.estimatedTime || 60,
    category: task.category || 'Work',
    tags: task.tags || [],
    difficulty: task.difficulty || 'Medium',
    preferred_working_time: task.preferredWorkingTime || null,
    is_recurring: !!task.isRecurring,
    recurring_frequency: task.recurringFrequency || null,
    progress: task.progress || 0,
    priority_score: task.priorityScore || 50,
    deadline_risk: task.deadlineRisk || 30,
    estimated_effort: task.estimatedEffort || null,
    ai_suggested_priority: task.aiSuggestedPriority || null,
    ai_suggested_time_block: task.aiSuggestedTimeBlock || null,
    project_id: task.projectId || null,
    team_id: task.teamId || null,
    organization_id: task.organizationId || null,
    missed_task_history: !!task.missedTaskHistory,
    created_at: task.createdAt || new Date().toISOString(),
    updated_at: task.updatedAt || new Date().toISOString(),
  };
}

function fromSupabaseTask(row: any): Task {
  return {
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
  };
}

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
router.get('/tasks', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (!error && data && data.length > 0) {
      const tasks = data.map(fromSupabaseTask);
      return res.json(tasks);
    }
  } catch (err) {
    console.warn('Supabase fetch failed, falling back to db.json:', err);
  }

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

  // 1. Try Supabase Insert
  try {
    const supabasePayload = toSupabaseTask(newTask);
    await supabase.from('tasks').insert(supabasePayload);
  } catch (sbErr) {
    console.warn('Supabase insert task failed, saved to local db:', sbErr);
  }

  // 2. Save to local db.json as sync backup
  const db = readDb();
  db.tasks.push(newTask);
  if (subtaskRecords.length > 0) {
    db.subtasks.push(...subtaskRecords);
  }
  createActivityLog(db, userId, 'Created task', `Added task "${newTask.title}"`, organizationId, teamId, projectId);
  createNotification(db, userId, 'New Task Created', `Task "${newTask.title}" was added to your workflow.`, 'success');
  writeDb(db);

  return res.json(newTask);
});

/**
 * Update Task
 * Host: PUT /api/tasks/:id
 */
router.put('/tasks/:id', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const taskId = req.params.id;
  const db = readDb();
  const taskIdx = db.tasks.findIndex((t) => t.id === taskId && t.userId === userId);

  const updatedTask: Task = {
    ...(taskIdx !== -1 ? db.tasks[taskIdx] : {
      id: taskId,
      userId,
      title: 'Updated Task',
      description: '',
      deadline: new Date().toISOString(),
      priority: 'Medium',
      status: 'Pending',
      estimatedTime: 60,
      category: 'Work',
      tags: [],
      difficulty: 'Medium',
      progress: 0,
      priorityScore: 50,
      deadlineRisk: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  if (taskIdx !== -1) {
    db.tasks[taskIdx] = updatedTask;
    writeDb(db);
  }

  try {
    await supabase.from('tasks').update(toSupabaseTask(updatedTask)).eq('id', taskId);
  } catch (err) {
    console.warn('Supabase update failed:', err);
  }

  return res.json(updatedTask);
});

/**
 * Update Task Status
 * Host: PATCH /api/tasks/:id/status
 */
router.patch('/tasks/:id/status', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const taskId = req.params.id;
  const { status } = req.body;
  const db = readDb();
  const taskIdx = db.tasks.findIndex((t) => t.id === taskId && t.userId === userId);

  if (taskIdx !== -1) {
    db.tasks[taskIdx].status = status;
    if (status === 'Completed') {
      db.tasks[taskIdx].progress = 100;
    }
    db.tasks[taskIdx].updatedAt = new Date().toISOString();
    writeDb(db);
  }

  try {
    await supabase.from('tasks').update({
      status,
      progress: status === 'Completed' ? 100 : undefined,
      updated_at: new Date().toISOString()
    }).eq('id', taskId);
  } catch (err) {
    console.warn('Supabase status patch failed:', err);
  }

  return res.json(taskIdx !== -1 ? db.tasks[taskIdx] : { id: taskId, status });
});

/**
 * Delete Task
 * Host: DELETE /api/tasks/:id
 */
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  const userId = getAuthorizedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const taskId = req.params.id;

  try {
    await supabase.from('tasks').delete().eq('id', taskId);
  } catch (err) {
    console.warn('Supabase delete failed:', err);
  }

  const db = readDb();
  db.tasks = db.tasks.filter((t) => !(t.id === taskId && t.userId === userId));
  db.subtasks = db.subtasks.filter((s) => s.taskId !== taskId);
  writeDb(db);

  return res.json({ success: true, id: taskId });
});

export default router;

import fs from 'fs';
import path from 'path';
import { 
  User, Task, Subtask, Habit, Notification, 
  DailySchedule, Analytic, CalendarEvent, AISuggestion, ChatMessage, Goal, Milestone,
  PredictionRecord, ConsistencySnapshot, SimulationHistory, RecoveryPlan,
  Organization, Team, Project, Comment, Reaction, ActivityLog, Invitation, WorkloadRecommendation 
} from '../src/types';

const isVercel = Boolean(process.env.VERCEL);
const DB_DIR = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, process.env.NODE_ENV === 'test' ? 'db.test.json' : 'db.json');
const INITIAL_SEED_FILE = path.join(process.cwd(), 'data', 'db.json');

interface DatabaseSchema {
  users: User[];
  tasks: Task[];
  subtasks: Subtask[];
  habits: Habit[];
  notifications: Notification[];
  schedules: DailySchedule[];
  analytics: Analytic[];
  calendarEvents: CalendarEvent[];
  aiSuggestions: AISuggestion[];
  chatMessages: { [userId: string]: ChatMessage[] };
  goals: Goal[];
  milestones: Milestone[];
  predictions: PredictionRecord[];
  consistencySnapshots: ConsistencySnapshot[];
  simulationHistory: SimulationHistory[];
  recoveryPlans: RecoveryPlan[];
  organizations: Organization[];
  teams: Team[];
  projects: Project[];
  comments: Comment[];
  reactions: Reaction[];
  activityLogs: ActivityLog[];
  invitations: Invitation[];
  workloadRecommendations: WorkloadRecommendation[];
}

const DEFAULT_DB: DatabaseSchema = {
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
};

function createDefaultDb(): DatabaseSchema {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function normalizeDb(data: Partial<DatabaseSchema> | null | undefined): DatabaseSchema {
  const normalized = createDefaultDb();

  if (!data || typeof data !== 'object') {
    return normalized;
  }

  (Object.keys(DEFAULT_DB) as Array<keyof DatabaseSchema>).forEach((key) => {
    const value = (data as Record<string, unknown>)[key as string];

    if (key === 'chatMessages') {
      normalized.chatMessages = value && typeof value === 'object' ? value as DatabaseSchema['chatMessages'] : {};
      return;
    }

    if (Array.isArray(value)) {
      normalized[key] = value as never;
    }
  });

  return normalized;
}

function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    if (isVercel && fs.existsSync(INITIAL_SEED_FILE)) {
      try {
        fs.copyFileSync(INITIAL_SEED_FILE, DB_FILE);
      } catch (err) {
        fs.writeFileSync(DB_FILE, JSON.stringify(createDefaultDb(), null, 2), 'utf-8');
      }
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(createDefaultDb(), null, 2), 'utf-8');
    }
  }
}

export function readDb(): DatabaseSchema {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return normalizeDb(JSON.parse(data) as Partial<DatabaseSchema>);
  } catch (error) {
    console.error('Failed to read database, resetting to default:', error);
    return createDefaultDb();
  }
}

export function writeDb(data: DatabaseSchema): void {
  ensureDbExists();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(normalizeDb(data), null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write database:', error);
  }
}

// Helper to seed a newly created user with comprehensive demo content
export function seedUserData(userId: string) {
  const db = readDb();
  const now = new Date();
  const starterProject = db.projects.find((p) => p.ownerId === userId);
  
  // 1. Create default habits
  const habits: Habit[] = [
    {
      id: `h-1-${userId}`,
      userId,
      title: 'Daily Coding Practice',
      category: 'Coding',
      frequency: 'Daily',
      streaks: 5,
      history: [
        getOffsetDateStr(-4),
        getOffsetDateStr(-3),
        getOffsetDateStr(-2),
        getOffsetDateStr(-1),
        getOffsetDateStr(0),
      ],
      createdAt: getOffsetDateStr(-10),
    },
    {
      id: `h-2-${userId}`,
      userId,
      title: 'Diaphragmatic Breathing',
      category: 'Meditation',
      frequency: 'Daily',
      streaks: 3,
      history: [
        getOffsetDateStr(-2),
        getOffsetDateStr(-1),
        getOffsetDateStr(0),
      ],
      createdAt: getOffsetDateStr(-5),
    },
    {
      id: `h-3-${userId}`,
      userId,
      title: 'Hydrate 2 Liters Water',
      category: 'Water',
      frequency: 'Daily',
      streaks: 8,
      history: [
        getOffsetDateStr(-7),
        getOffsetDateStr(-6),
        getOffsetDateStr(-5),
        getOffsetDateStr(-4),
        getOffsetDateStr(-3),
        getOffsetDateStr(-2),
        getOffsetDateStr(-1),
        getOffsetDateStr(0),
      ],
      createdAt: getOffsetDateStr(-10),
    },
  ];

  // 2. Create demo tasks
  const tasks: Task[] = [
    {
      id: `t-1-${userId}`,
      userId,
      projectId: starterProject?.id,
      title: 'Complete Hackathon Proposal Pitch',
      description: 'Prepare the core deck and implementation plan for the final showcase. Need to define our core value proposition and system architecture diagram.',
      deadline: getOffsetDateIso(1), // Tomorrow
      priority: 'Critical',
      status: 'In Progress',
      estimatedTime: 120, // 2 hours
      category: 'Work',
      tags: ['hackathon', 'pitch', 'docs'],
      difficulty: 'Hard',
      progress: 60,
      priorityScore: 92,
      deadlineRisk: 75,
      missedTaskHistory: false,
      createdAt: getOffsetDateIso(-1),
      updatedAt: getOffsetDateIso(0),
    },
    {
      id: `t-2-${userId}`,
      userId,
      projectId: starterProject?.id,
      title: 'Implement Smart Reminder Engine',
      description: 'Write the back-end AI-agent triggers to check when a task\'s deadline is closer than estimated hours and suggest start offsets.',
      deadline: getOffsetDateIso(2), // In 2 days
      priority: 'High',
      status: 'Pending',
      estimatedTime: 180, // 3 hours
      category: 'Coding',
      tags: ['backend', 'ai', 'express'],
      difficulty: 'Medium',
      progress: 0,
      priorityScore: 78,
      deadlineRisk: 45,
      missedTaskHistory: false,
      createdAt: getOffsetDateIso(-2),
      updatedAt: getOffsetDateIso(0),
    },
    {
      id: `t-3-${userId}`,
      userId,
      projectId: starterProject?.id,
      title: 'Read Chapter 4 of System Architecture Book',
      description: 'Review sections on eventual consistency, state machines, and relational mapping.',
      deadline: getOffsetDateIso(4), // In 4 days
      priority: 'Medium',
      status: 'Pending',
      estimatedTime: 60, // 1 hour
      category: 'Study',
      tags: ['reading', 'theory'],
      difficulty: 'Easy',
      progress: 0,
      priorityScore: 50,
      deadlineRisk: 15,
      missedTaskHistory: false,
      createdAt: getOffsetDateIso(-3),
      updatedAt: getOffsetDateIso(0),
    },
    {
      id: `t-4-${userId}`,
      userId,
      projectId: starterProject?.id,
      title: 'Configure Firebase Cloud Messaging Keys',
      description: 'Add server configuration and setup service workers for push reminders.',
      deadline: getOffsetDateIso(-1), // Yesterday (missed!)
      priority: 'Low',
      status: 'Missed',
      estimatedTime: 45,
      category: 'Work',
      tags: ['infrastructure', 'secrets'],
      difficulty: 'Medium',
      progress: 0,
      priorityScore: 10,
      deadlineRisk: 100,
      missedTaskHistory: true,
      createdAt: getOffsetDateIso(-5),
      updatedAt: getOffsetDateIso(-1),
    }
  ];

  // 3. Create subtasks for Pitch (t-1)
  const subtasks: Subtask[] = [
    {
      id: `st-1-${userId}`,
      taskId: `t-1-${userId}`,
      title: 'Draft problem statement and solution scope',
      completed: true,
      estimatedTime: 30,
      weightage: 30,
      order: 1,
    },
    {
      id: `st-2-${userId}`,
      taskId: `t-1-${userId}`,
      title: 'Outline database schema structure',
      completed: true,
      estimatedTime: 30,
      weightage: 30,
      order: 2,
    },
    {
      id: `st-3-${userId}`,
      taskId: `t-1-${userId}`,
      title: 'Design high-fidelity glassmorphism mockups',
      completed: false,
      estimatedTime: 60,
      weightage: 40,
      order: 3,
    },
  ];

  // 4. Create local calendar events representing conflicts
  const calendarEvents: CalendarEvent[] = [
    {
      id: `ce-1-${userId}`,
      userId,
      title: 'Weekly Standup Sync',
      startTime: getOffsetDateIsoWithHour(0, 10, 0), // Today 10:00 AM
      endTime: getOffsetDateIsoWithHour(0, 11, 0), // Today 11:00 AM
      source: 'local',
      conflictDetected: false,
    },
    {
      id: `ce-2-${userId}`,
      userId,
      title: 'Product Review Meeting',
      startTime: getOffsetDateIsoWithHour(1, 14, 0), // Tomorrow 2:00 PM
      endTime: getOffsetDateIsoWithHour(1, 15, 30), // Tomorrow 3:30 PM
      source: 'local',
      conflictDetected: true, // will trigger smart re-planner alerts!
    }
  ];

  // 5. Create demo schedules for today and tomorrow
  const schedules: DailySchedule[] = [
    {
      id: `s-1-${userId}`,
      userId,
      date: getOffsetDateStr(0), // Today
      items: [
        { id: `s-item-1-${userId}`, title: 'Morning Hydration & Planning', startTime: '08:30', endTime: '09:00', type: 'habit', referenceId: `h-3-${userId}` },
        { id: `s-item-2-${userId}`, title: 'Weekly Standup Sync', startTime: '10:00', endTime: '11:00', type: 'meeting', referenceId: `ce-1-${userId}` },
        { id: `s-item-3-${userId}`, title: 'Task: Complete Hackathon Proposal Pitch (UI Design Part)', startTime: '11:15', endTime: '12:15', type: 'task', referenceId: `t-1-${userId}` },
        { id: `s-item-4-${userId}`, title: 'Lunch & Relax', startTime: '12:30', endTime: '13:30', type: 'break' },
        { id: `s-item-5-${userId}`, title: 'Task: Complete Hackathon Proposal Pitch (Review)', startTime: '14:00', endTime: '15:00', type: 'task', referenceId: `t-1-${userId}` },
        { id: `s-item-6-${userId}`, title: 'Diaphragmatic Breathing Meditation', startTime: '16:00', endTime: '16:20', type: 'habit', referenceId: `h-2-${userId}` },
      ],
      createdAt: getOffsetDateIso(0),
    },
  ];

  // 6. Create historical Analytics for last 7 days
  const analytics: Analytic[] = [];
  for (let i = 7; i >= 1; i--) {
    analytics.push({
      id: `a-day-${i}-${userId}`,
      userId,
      date: getOffsetDateStr(-i),
      tasksCompleted: i % 2 === 0 ? 3 : 2,
      tasksMissed: i === 5 ? 1 : 0,
      totalWorkTime: i % 3 === 0 ? 240 : 180,
      focusTime: i % 3 === 0 ? 150 : 120,
      score: i % 2 === 0 ? 88 : 75,
    });
  }

  // 7. Create AI suggestions
  const aiSuggestions: AISuggestion[] = [
    {
      id: `as-1-${userId}`,
      userId,
      taskId: `t-1-${userId}`,
      title: 'Critical Deadline Risk Warning',
      suggestion: 'You still need around 60 minutes of focus time to finish the "Complete Hackathon Proposal Pitch" deck. To make up for your standup meeting delay, start within the next 15 minutes to meet tomorrow\'s deadline safely.',
      type: 'urgency_warning',
      actioned: false,
      createdAt: getOffsetDateIso(0),
    },
    {
      id: `as-2-${userId}`,
      userId,
      title: 'Habit Re-Anchor Recommendation',
      suggestion: 'Your morning hydration streak is at 8 days, but you tend to skip diaphragmatic breathing on high-pressure days. Let\'s pair breathing with your lunch break tomorrow to lower stress and lock in focus.',
      type: 'coach_motivation',
      actioned: false,
      createdAt: getOffsetDateIso(0),
    }
  ];

  // 8. Create default welcome notifications
  const notifications: Notification[] = [
    {
      id: `n-1-${userId}`,
      userId,
      title: 'Welcome to Last-Minute Life Saver! 🚀',
      message: 'I am your AI Productivity Coach. I have analysed your pending workload, predicted deadline risks, and scheduled your day around existing events.',
      type: 'success',
      read: false,
      createdAt: getOffsetDateIso(0),
    },
    {
      id: `n-2-${userId}`,
      userId,
      title: 'Upcoming Pitch Deadline Warning',
      message: 'Pitch proposal task is due tomorrow. Deadline risk estimated at 75%. Click on suggestions to view coach advice.',
      type: 'warning',
      read: false,
      createdAt: getOffsetDateIso(0),
    }
  ];

  // Push all to DB
  db.habits.push(...habits);
  db.tasks.push(...tasks);
  db.subtasks.push(...subtasks);
  db.calendarEvents.push(...calendarEvents);
  db.schedules.push(...schedules);
  db.analytics.push(...analytics);
  db.aiSuggestions.push(...aiSuggestions);
  db.notifications.push(...notifications);
  
  writeDb(db);
}

// Utility to get offset date in format YYYY-MM-DD
function getOffsetDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Utility to get offset ISO date string
function getOffsetDateIso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

// Utility to get offset date with explicit hours/minutes in ISO format
function getOffsetDateIsoWithHour(offsetDays: number, hour: number, minutes: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
}

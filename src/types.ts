export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Missed';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type SuggestionType = 'urgency_warning' | 'breakdown' | 'scheduler_reorg' | 'coach_motivation';
export type NotificationType = 'info' | 'warning' | 'success' | 'reminder';

export interface User {
  id: string;
  email: string;
  name: string;
  productivityScore: number;
  avatarUrl?: string;
  theme: 'light' | 'dark';
  workHoursStart: string; // e.g., "09:00"
  workHoursEnd: string; // e.g., "17:00"
  focusPeriod: number; // in minutes, e.g., 25
  streakCount: number;
  password?: string; // Hashed password
  role?: 'user' | 'admin' | 'owner' | 'manager' | 'employee' | 'guest'; // Future ready role support
  refreshTokens?: string[]; // Session refresh tokens
  // Google Calendar integration
  googleCalendarLinked?: boolean;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  organizationIds?: string[];
  teamIds?: string[];
  projectIds?: string[];
  skills?: string[];
  currentWorkload?: number;
  active?: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  deadline: string; // ISO string
  priority: PriorityLevel;
  status: TaskStatus;
  estimatedTime: number; // in minutes
  category: string; // e.g., "Study", "Work", "Personal"
  tags: string[];
  difficulty: DifficultyLevel;
  preferredWorkingTime?: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  isRecurring?: boolean;
  recurringFrequency?: 'Daily' | 'Weekly' | 'Monthly';

  progress: number; // 0-100 calculated by subtasks
  priorityScore: number; // 0-100 calculated by AI
  deadlineRisk: number; // 0-100 percentage prediction
  estimatedEffort?: number; // 0-100 AI suggested effort
  aiSuggestedPriority?: PriorityLevel;
  aiSuggestedTimeBlock?: string; // "HH:MM-HH:MM"

  assignedToId?: string;
  confidenceScore?: number; // 0-100
  riskScore?: number; // 0-100
  completionProbability?: number; // 0-100
  importanceScore?: number; // 0-100
  urgencyScore?: number; // 0-100
  aiExplanation?: string;
  dependencyIds?: string[];
  goalId?: string;
  milestoneId?: string;
  projectId?: string;
  teamId?: string;
  organizationId?: string;
  missedTaskHistory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  completed: boolean;
  estimatedTime: number; // in minutes
  deadline?: string; // optional ISO string
  priority?: PriorityLevel;
  weightage: number; // percentage (0-100)
  order: number;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  category: string; // "Reading", "Coding", "Exercise", "Meditation", "Water", "Sleep"
  frequency: 'Daily' | 'Weekly';
  streaks: number;
  history: string[]; // array of 'YYYY-MM-DD' dates
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  workspaceId?: string;
  projectId?: string;
  teamId?: string;
  taskId?: string;
}

export interface PresenceStatus {
  userId: string;
  workspaceId: string;
  status: 'online' | 'offline' | 'away' | 'typing';
  lastActiveAt: string;
}

export interface TeamHealth {
  teamId: string;
  name?: string;
  organizationId?: string;
  projectId?: string;
  healthScore: number; // 0-100
  workloadBalanceScore: number; // 0-100
  activeTaskCount: number;
  overdueTaskCount: number;
  engagementScore: number; // 0-100
  averageProductivity?: number;
  completionRate?: number;
  memberCount?: number;
}

export interface ProjectHealth {
  projectId: string;
  title?: string;
  organizationId?: string;
  healthScore?: number; // 0-100
  progress?: number;
  deadlineRisk?: number;
  burnoutRisk?: number;
  dependencies?: number;
  aiHealthScore?: number;
}

export interface AITeamBalancerRecommendation {
  recommendationId: string;
  title: string;
  description: string;
  affectedTeamId: string;
  affectedProjectId?: string;
  suggestedReallocation: {
    fromUserId: string;
    toUserId: string;
    taskId: string;
    reasoning: string;
  }[];
  confidenceScore: number; // 0-100
  createdAt: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'employee' | 'guest' | 'user';

export interface Organization {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  teamIds: string[];
  projectIds: string[];
  createdAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  memberIds: string[];
  projectIds: string[];
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  teamId?: string;
  title: string;
  description: string;
  ownerId: string;
  managerId?: string;
  memberIds: string[];
  goalIds: string[];
  milestoneIds: string[];
  taskIds: string[];
  startDate: string;
  endDate: string;
  status: 'Active' | 'Paused' | 'Completed' | 'At Risk';
  progress: number;
  riskScore: number;
  burnoutRisk: number;
  capacityScore: number;
  healthScore: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  targetType: 'task' | 'comment' | 'project' | 'activity';
  targetId: string;
  taskId?: string;
  userId: string;
  content: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReactionEmoji = '👍' | '🔥' | '🚀' | '🎉' | '👀' | '❤️';

export interface Reaction {
  id: string;
  targetType: 'task' | 'comment' | 'project' | 'activity';
  targetId: string;
  userId: string;
  emoji: ReactionEmoji;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  organizationId?: string;
  teamId?: string;
  projectId?: string;
  userId: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  teamId?: string;
  projectId?: string;
  email: string;
  senderId: string;
  role: OrganizationRole;
  status: 'Pending' | 'Accepted' | 'Rejected';
  createdAt: string;
  respondedAt?: string;
}

export interface WorkloadRecommendation {
  id: string;
  recommendedFromUserId: string;
  recommendedToUserId: string;
  taskId: string;
  reason: string;
  estimatedCompletionIncrease: number;
  createdAt: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  type: 'task' | 'meeting' | 'break' | 'habit' | 'goal' | 'focus';
  referenceId?: string; // task ID, habit ID, etc.
  estimatedDuration?: number;
  priorityScore?: number;
  completionProbability?: number;
  aiNote?: string;
  status?: TaskStatus;
}

export interface DailySchedule {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  items: ScheduleItem[];
  createdAt: string;
}

export interface Analytic {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  tasksCompleted: number;
  tasksMissed: number;
  totalWorkTime: number; // in minutes
  focusTime: number; // in minutes
  score: number; // 0-100
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  source: 'google' | 'local';
  conflictDetected: boolean;
}

export interface AISuggestion {
  id: string;
  userId: string;
  taskId?: string;
  title: string;
  suggestion: string;
  explanation?: string;
  type: SuggestionType;
  actioned: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'Active' | 'Completed' | 'Paused';
  progress: number; // 0-100 calculated by linked tasks
  projectId?: string;
  teamId?: string;
  organizationId?: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  description: string;
  taskIds: string[];
  projectId?: string;
  organizationId?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  createdAt: string;
}

export interface Prediction {
  estimatedSuccessRate: number; // 0-100
  completionProbability: number; // 0-100
  todayCompletionChance: number; // 0-100
  tomorrowWorkloadMinutes: number;
  weeklyCompletionChance: number; // 0-100
  burnoutProbability: number; // 0-100
  deadlineFailureProbability: number; // 0-100
  recommendedSleepHours: number;
  recommendedBreakFrequency: string;
  recommendedFocusDuration: number;
  bestFocusWindow: string;
  explanation: string;
}

export interface ConsistencyMetrics {
  currentStreak: number;
  weeklyConsistency: number; // 0-100
  monthlyConsistency: number; // 0-100
  focusTrend: string;
  goalCompletionRate: number; // 0-100
  aiProductivityScore: number; // 0-100
  burnoutLevel: number; // 0-100
  weeklyHeatmap: { date: string; intensity: number }[];
  monthlyHeatmap: { date: string; intensity: number }[];
  taskTimeline: { date: string; completed: number; missed: number }[];
  progressRings: {
    label: string;
    value: number;
    description: string;
  }[];
}

export interface PredictionRecord {
  id: string;
  userId: string;
  prediction: Prediction;
  createdAt: string;
}

export interface ConsistencySnapshot {
  id: string;
  userId: string;
  metrics: ConsistencyMetrics;
  createdAt: string;
}

export interface SimulationHistory {
  id: string;
  userId: string;
  simulationType: string;
  changes: any;
  result: {
    predictedChange: Partial<Prediction>;
    notes: string;
    schedule?: ScheduleItem[];
    riskAnalysis?: string;
  };
  createdAt: string;
}

export interface RecoveryPlan {
  id: string;
  userId: string;
  availableHours: number;
  pendingTasks: string[];
  deadlines: string[];
  meetings: string[];
  plan: string[];
  schedule: ScheduleItem[];
  completionProbability: number;
  criticalTasks: string[];
  optionalTasks: string[];
  recommendedOrder: string[];
  estimatedSuccess: number;
  estimatedRisk: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

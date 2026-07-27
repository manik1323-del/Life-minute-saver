import { 
  User, Task, Subtask, Habit, Notification, 
  DailySchedule, Analytic, CalendarEvent, AISuggestion, ChatMessage, 
  Goal, Milestone, Prediction, ConsistencyMetrics, RecoveryPlan,
  Organization, Team, Project, Comment, Reaction, ActivityLog, Invitation, WorkloadRecommendation,
  TeamHealth, ProjectHealth, AITeamBalancerRecommendation, PriorityLevel
} from "../types";
import { DEMO_MODE, DEMO_TOKEN } from "./demoUser";

const fetchWrapper = async (url: string | URL, options: RequestInit = {}): Promise<Response> => {
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  } as any;

  const token = localStorage.getItem("last_minute_token");
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await window.fetch(url, { ...options, headers });

  // In demo mode, the demo token is permanent — skip the refresh loop entirely.
  // The server accepts DEMO_TOKEN without expiry checks.
  if (DEMO_MODE && token === DEMO_TOKEN) {
    return res;
  }

  // If unauthorized (401), attempt to silently refresh access token
  if (res.status === 401 && token) {
    const refreshToken = localStorage.getItem("last_minute_refresh_token");
    if (refreshToken) {
      try {
        console.warn("Session unauthorized. Attempting background token refresh...");
        const refreshRes = await window.fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          localStorage.setItem("last_minute_token", refreshData.token);
          if (refreshData.refreshToken) {
            localStorage.setItem("last_minute_refresh_token", refreshData.refreshToken);
          }
          
          // Retry the original request with the newly issued access token
          headers["Authorization"] = `Bearer ${refreshData.token}`;
          res = await window.fetch(url, { ...options, headers });
        } else {
          console.error("Refresh token invalid or expired. Logging out...");
          localStorage.removeItem("last_minute_token");
          localStorage.removeItem("last_minute_refresh_token");
          window.dispatchEvent(new Event("auth-expired"));
        }
      } catch (err) {
        console.error("Token refresh process failed:", err);
      }
    }
  }

  return res;
};

const fetch = fetchWrapper;

// Internal helper — only used for the few calls that explicitly need the auth header outside fetchWrapper
const getAuthHeader = () => {
  const token = localStorage.getItem("last_minute_token") || "";
  return { "Authorization": `Bearer ${token}` };
};

export const api = {
  // 1. Authentication
  async signup(email: string, name: string, password?: string): Promise<{ token: string; refreshToken: string; user: User }> {
    const res = await fetchWrapper("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Signup failed");
    return res.json();
  },

  async login(email: string, password?: string): Promise<{ token: string; refreshToken: string; user: User }> {
    const res = await fetchWrapper("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error((await res.json()).error || "Login failed");
    return res.json();
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  async getMe(): Promise<User> {
    const res = await fetch("/api/auth/me", { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch user context");
    return res.json();
  },

  async updateMe(data: Partial<User>): Promise<User> {
    const res = await fetch("/api/auth/me", {
      method: "PUT",
      headers: getAuthHeader(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update user profile");
    return res.json();
  },

  // 2. Tasks
  async getTasks(): Promise<Task[]> {
    const res = await fetch("/api/tasks", { headers: getAuthHeader() });
    return res.json();
  },

  async createTask(task: Partial<Task> & { subtasks?: any[] }): Promise<Task> {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(task)
    });
    return res.json();
  },

  async updateTask(id: string, task: Partial<Task>): Promise<Task> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: JSON.stringify(task)
    });
    return res.json();
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    return res.json();
  },

  // 3. Subtasks
  async getSubtasks(taskId: string): Promise<Subtask[]> {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, { headers: getAuthHeader() });
    return res.json();
  },

  async createSubtask(taskId: string, title: string, estimatedTime?: number): Promise<Subtask> {
    const res = await fetch("/api/subtasks", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ taskId, title, estimatedTime })
    });
    return res.json();
  },

  async updateSubtask(id: string, completed: boolean): Promise<Subtask> {
    const res = await fetch(`/api/subtasks/${id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: JSON.stringify({ completed })
    });
    return res.json();
  },

  async deleteSubtask(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/subtasks/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    return res.json();
  },

  // 4. Habits
  async getHabits(): Promise<Habit[]> {
    const res = await fetch("/api/habits", { headers: getAuthHeader() });
    return res.json();
  },

  async createHabit(title: string, category: string, frequency: string): Promise<Habit> {
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ title, category, frequency })
    });
    return res.json();
  },

  async toggleHabit(id: string, date: string): Promise<Habit> {
    const res = await fetch(`/api/habits/${id}/toggle`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ date })
    });
    return res.json();
  },

  async deleteHabit(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/habits/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    return res.json();
  },

  // 5. Notifications
  async getNotifications(): Promise<Notification[]> {
    const res = await fetch("/api/notifications", { headers: getAuthHeader() });
    return res.json();
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      headers: getAuthHeader()
    });
    return res.json();
  },

  // 6. Daily Schedule
  async getSchedule(date: string): Promise<DailySchedule> {
    const res = await fetch(`/api/schedules?date=${date}`, { headers: getAuthHeader() });
    return res.json();
  },

  async createScheduleItem(date: string, title: string, startTime: string, endTime: string, type: string): Promise<DailySchedule> {
    const res = await fetch("/api/schedules/item", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ date, title, startTime, endTime, type })
    });
    return res.json();
  },

  async deleteScheduleItem(scheduleId: string, itemId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/schedules/${scheduleId}/items/${itemId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    return res.json();
  },

  // 7. Calendar
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const res = await fetch("/api/calendar", { headers: getAuthHeader() });
    return res.json();
  },

  async createCalendarEvent(title: string, startTime: string, endTime: string): Promise<CalendarEvent> {
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ title, startTime, endTime })
    });
    return res.json();
  },

  // 8. Analytics
  async getAnalytics(): Promise<Analytic[]> {
    const res = await fetch("/api/analytics", { headers: getAuthHeader() });
    return res.json();
  },

  async getPredictions(): Promise<Prediction> {
    const res = await fetch("/api/ai/predictions", { headers: getAuthHeader() });
    return res.json();
  },

  async getConsistency(): Promise<ConsistencyMetrics> {
    const res = await fetch("/api/ai/consistency", { headers: getAuthHeader() });
    return res.json();
  },

  async simulateWhatIf(taskId: string, simulationType: string, changes: any): Promise<any> {
    const res = await fetch("/api/ai/simulate", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ taskId, simulationType, changes })
    });
    return res.json();
  },

  async rescueMyDay(payload: { availableHours: number; pendingTasks?: string[]; meetings?: string[]; deadlines?: string[] }): Promise<any> {
    const res = await fetch("/api/ai/rescue", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async getGoals(): Promise<{ goals: Goal[]; milestones: Milestone[] }> {
    const res = await fetch("/api/goals", { headers: getAuthHeader() });
    return res.json();
  },

  async createGoal(goal: { title: string; description: string; milestones?: { title: string; description?: string; taskIds?: string[]; status?: string }[] }): Promise<any> {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(goal)
    });
    return res.json();
  },

  async updateGoal(goalId: string, payload: { title?: string; description?: string; status?: string; milestones?: { id?: string; title?: string; description?: string; taskIds?: string[]; status?: string; createdAt?: string }[] }): Promise<any> {
    const res = await fetch(`/api/goals/${goalId}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async deleteGoal(goalId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/goals/${goalId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    });
    return res.json();
  },

  // 9. AI Operations (Triggers)
  async runAIPrioritization(): Promise<{ success: boolean; tasks: Task[] }> {
    const res = await fetch("/api/ai/prioritize", {
      method: "POST",
      headers: getAuthHeader()
    });
    return res.json();
  },

  async runAIBreakdown(taskId: string): Promise<Subtask[]> {
    const res = await fetch("/api/ai/breakdown", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ taskId })
    });
    return res.json();
  },

  async runAISmartScheduler(date: string): Promise<{ success: boolean; schedule: DailySchedule }> {
    const res = await fetch("/api/ai/schedule", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ date })
    });
    return res.json();
  },

  async analyzeTask(title: string, description?: string): Promise<{
    subtasks: any[];
    estimatedEffort: number;
    aiSuggestedPriority: PriorityLevel;
    aiSuggestedTimeBlock: string;
    riskLevel: number;
  }> {
    const res = await fetch("/api/ai/analyze-task", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ title, description })
    });
    return res.json();
  },

  async sendCoachMessage(message: string): Promise<{ message: ChatMessage; history: ChatMessage[] }> {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ message })
    });
    return res.json();
  },

  async getCoachHistory(): Promise<ChatMessage[]> {
    const res = await fetch("/api/ai/chat", { headers: getAuthHeader() });
    return res.json();
  },

  async getAISuggestions(): Promise<AISuggestion[]> {
    const res = await fetch("/api/ai/suggestions", { headers: getAuthHeader() });
    return res.json();
  },

  async refreshAISuggestions(): Promise<AISuggestion[]> {
    const res = await fetch("/api/ai/suggestions/refresh", {
      method: "POST",
      headers: getAuthHeader()
    });
    return res.json();
  },

  async getOrganizations(): Promise<Organization[]> {
    const res = await fetch("/api/workspace/organizations", { headers: getAuthHeader() });
    return res.json();
  },

  async createOrganization(name: string, description?: string): Promise<Organization> {
    const res = await fetch("/api/workspace/organizations", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ name, description })
    });
    return res.json();
  },

  async getTeams(): Promise<Team[]> {
    const res = await fetch("/api/workspace/teams", { headers: getAuthHeader() });
    return res.json();
  },

  async createTeam(organizationId: string, name: string, description?: string): Promise<Team> {
    const res = await fetch("/api/workspace/teams", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ organizationId, name, description })
    });
    return res.json();
  },

  async getProjects(): Promise<Project[]> {
    const res = await fetch("/api/workspace/projects", { headers: getAuthHeader() });
    return res.json();
  },

  async createProject(organizationId: string, title: string, description?: string, teamId?: string): Promise<Project> {
    const res = await fetch("/api/workspace/projects", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ organizationId, title, description, teamId })
    });
    return res.json();
  },

  async getWorkspaceActivity(): Promise<ActivityLog[]> {
    const res = await fetch("/api/workspace/activity", { headers: getAuthHeader() });
    return res.json();
  },

  async getWorkspaceComments(targetType: string, targetId: string): Promise<Comment[]> {
    const res = await fetch(`/api/workspace/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, {
      headers: getAuthHeader()
    });
    return res.json();
  },

  async createWorkspaceComment(targetType: string, targetId: string, content: string, parentId?: string): Promise<Comment> {
    const res = await fetch("/api/workspace/comments", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ targetType, targetId, content, parentId })
    });
    return res.json();
  },

  async getWorkspaceReactions(targetType: string, targetId: string): Promise<Reaction[]> {
    const res = await fetch(`/api/workspace/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, {
      headers: getAuthHeader()
    });
    return res.json();
  },

  async createWorkspaceReaction(targetType: string, targetId: string, emoji: string): Promise<Reaction> {
    const res = await fetch("/api/workspace/reactions", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ targetType, targetId, emoji })
    });
    return res.json();
  },

  async getWorkspaceMembers(): Promise<(User & { presence: any })[]> {
    const res = await fetch("/api/workspace/members", { headers: getAuthHeader() });
    return res.json();
  },

  async getWorkspaceTeamSummary(): Promise<{ teams: TeamHealth[]; projects: ProjectHealth[] }> {
    const res = await fetch("/api/workspace/team-summary", { headers: getAuthHeader() });
    return res.json();
  },

  async getDailyStandup(): Promise<any[]> {
    const res = await fetch("/api/workspace/daily-standup", { headers: getAuthHeader() });
    return res.json();
  },

  async getAITeamBalancer(): Promise<AITeamBalancerRecommendation> {
    const res = await fetch("/api/workspace/ai/balance-team", {
      method: "POST",
      headers: getAuthHeader()
    });
    return res.json();
  },

  async acceptAITeamBalancer(taskId: string, toUserId: string): Promise<{ success: boolean; task: Task }> {
    const res = await fetch("/api/workspace/ai/balance-team/accept", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ taskId, toUserId })
    });
    return res.json();
  },

  async getInvitations(): Promise<Invitation[]> {
    const res = await fetch("/api/workspace/invitations", { headers: getAuthHeader() });
    return res.json();
  },

  async createInvitation(organizationId: string, email: string, role: string, teamId?: string, projectId?: string): Promise<Invitation> {
    const res = await fetch("/api/workspace/invitations", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ organizationId, email, role, teamId, projectId })
    });
    return res.json();
  },

  async getWorkloadRecommendations(): Promise<WorkloadRecommendation[]> {
    const res = await fetch("/api/workspace/workload/recommendations", { headers: getAuthHeader() });
    return res.json();
  },

  async createWorkloadRecommendation(recommendedToUserId: string, taskId: string, reason: string): Promise<WorkloadRecommendation> {
    const res = await fetch("/api/workspace/workload/recommendations", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ recommendedToUserId, taskId, reason })
    });
    return res.json();
  },

  // 10. Analytics: Record a completed focus session
  async recordFocusSession(durationMinutes: number): Promise<{ success: boolean }> {
    const res = await fetch("/api/analytics/focus", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ durationMinutes })
    });
    return res.json();
  }
};

import { GoogleGenAI, Type } from "@google/genai";
import { Task, Subtask, DailySchedule, ScheduleItem, Habit, CalendarEvent, AISuggestion, ChatMessage, Goal, Milestone, Prediction, ConsistencyMetrics, PriorityLevel } from "../src/types";

// Initialize Gemini SDK with User-Agent header for AI Studio
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MOCK_KEY_IF_ABSENT',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const MODEL_NAME = 'gemini-2.0-flash';

// Helper to check if API key is configured
function isApiKeyConfigured(): boolean {
  return process.env.GEMINI_API_KEY !== undefined && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && process.env.GEMINI_API_KEY !== '';
}

/**
 * Robust wrapper for generating content with a retry policy and model fallbacks.
 * If gemini-2.0-flash fails or returns 503, it falls back to gemini-1.5-flash-8b.
 */
async function safeGenerateContent(params: {
  contents: any;
  config?: any;
}): Promise<any> {
  const modelsToTry = [MODEL_NAME, 'gemini-1.5-flash-8b'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Attempting Gemini generateContent using ${model} (attempt ${attempt}/2)...`);
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini call to ${model} failed (attempt ${attempt}/2):`, error.message || error);
        if (attempt < 2) {
          // Brief backoff before retry
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
    }
  }
  throw lastError || new Error("Failed to generate content from any Gemini models");
}

/**
 * Programmatic fallback for task prioritization and risk calculation.
 */
function localPrioritizeTasks(tasks: Task[], calendarEvents: CalendarEvent[]): Partial<Task>[] {
  return tasks.map(t => {
    const hoursToDeadline = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    let deadlineRisk = 50;
    let priorityScore = 50;
    
    if (hoursToDeadline < 0) {
      deadlineRisk = 100;
      priorityScore = 95;
    } else if (hoursToDeadline < 24) {
      deadlineRisk = 85;
      priorityScore = 90;
    } else if (hoursToDeadline < 48) {
      deadlineRisk = 60;
      priorityScore = 70;
    } else {
      deadlineRisk = 20;
      priorityScore = 40;
    }
    
    let priority = t.priority;
    if (priorityScore > 85) priority = 'Critical';
    else if (priorityScore > 65) priority = 'High';
    else if (priorityScore > 40) priority = 'Medium';
    else priority = 'Low';

    return {
      id: t.id,
      priority,
      priorityScore,
      deadlineRisk,
    };
  });
}

/**
 * 1. TASK PRIORITIZATION & RISK ENGINE
 * Analyzes tasks to compute urgency priorityScore (0-100) and deadlineRisk (0-100%).
 */
export async function prioritizeTasks(tasks: Task[], calendarEvents: CalendarEvent[]): Promise<Partial<Task>[]> {
  if (!isApiKeyConfigured()) {
    console.warn("Gemini API key is not configured. Falling back to rule-based prioritization.");
    return localPrioritizeTasks(tasks, calendarEvents);
  }

  try {
    const prompt = `Analyze these tasks and return updated priority scores (0-100) and deadline risk probabilities (0-100%).
Take into consideration:
- Task estimated time vs. time left before deadline.
- Task baseline importance level.
- High risk if time left is less than 1.5 times the estimated duration.
- Calendar event density (more events = higher risk).

Tasks to analyze:
${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline, priority: t.priority, estimatedTime: t.estimatedTime, status: t.status })), null, 2)}

Existing Calendar Events:
${JSON.stringify(calendarEvents.map(e => ({ title: e.title, start: e.startTime, end: e.endTime })), null, 2)}`;

    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        systemInstruction: "You are a smart AI prioritization engine. Calculate deadline completion risk (%) and a normalized priority score (0-100) for each task. Be highly accurate, penalizing tight deadlines and high workloads with realistic risk percentages.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['Critical', 'High', 'Medium', 'Low'] },
              priorityScore: { type: Type.INTEGER, description: " Urgency priority, 0 to 100." },
              deadlineRisk: { type: Type.INTEGER, description: "Risk % of missing deadline, 0 to 100." }
            },
            required: ['id', 'priority', 'priorityScore', 'deadlineRisk']
          }
        }
      }
    });

    const text = response.text?.trim() || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Task Prioritizer failed entirely, falling back to rule-based prioritization:", error);
    return localPrioritizeTasks(tasks, calendarEvents);
  }
}

/**
 * AI ENHANCED TASK ANALYZER
 * Suggests subtasks, weightages, effort, and scheduling for a new task.
 */
export async function analyzeAndEnhanceTask(taskTitle: string, taskDescription: string): Promise<{
  subtasks: Omit<Subtask, 'id' | 'taskId'>[];
  estimatedEffort: number;
  aiSuggestedPriority: PriorityLevel;
  aiSuggestedTimeBlock: string;
  riskLevel: number;
}> {
  if (!isApiKeyConfigured()) {
    return {
      subtasks: [
        { title: 'Information Gathering', description: 'Initial research', completed: false, estimatedTime: 30, weightage: 20, order: 1 },
        { title: 'Core Implementation', description: 'Main development phase', completed: false, estimatedTime: 120, weightage: 60, order: 2 },
        { title: 'Review & Polish', description: 'Final touches and verification', completed: false, estimatedTime: 30, weightage: 20, order: 3 },
      ],
      estimatedEffort: 65,
      aiSuggestedPriority: 'Medium',
      aiSuggestedTimeBlock: '10:00-12:00',
      riskLevel: 30
    };
  }

  try {
    const prompt = `Analyze this task and provide a comprehensive implementation plan:
Task Title: "${taskTitle}"
Description: "${taskDescription}"

Generate:
1. A list of 3-6 logical subtasks. Each must have a title, short description, estimated duration (mins), and weightage (% of total task). Weightages MUST sum to 100.
2. Estimated overall effort (0-100).
3. Suggested priority (Critical, High, Medium, Low).
4. Suggested 2-hour time block for focus (e.g. "09:00-11:00").
5. Deadline risk level (0-100) based on typical complexity.`;

    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        systemInstruction: "You are an expert project manager and AI scheduler. Provide realistic task breakdowns and complexity analysis in valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  estimatedTime: { type: Type.INTEGER },
                  weightage: { type: Type.INTEGER },
                  order: { type: Type.INTEGER }
                },
                required: ['title', 'estimatedTime', 'weightage', 'order']
              }
            },
            estimatedEffort: { type: Type.INTEGER },
            aiSuggestedPriority: { type: Type.STRING, enum: ['Critical', 'High', 'Medium', 'Low'] },
            aiSuggestedTimeBlock: { type: Type.STRING },
            riskLevel: { type: Type.INTEGER }
          },
          required: ['subtasks', 'estimatedEffort', 'aiSuggestedPriority', 'aiSuggestedTimeBlock', 'riskLevel']
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    return {
      ...result,
      subtasks: result.subtasks.map((s: any) => ({ ...s, completed: false }))
    };
  } catch (error) {
    console.error("AI Task Enhancement failed:", error);
    return {
      subtasks: [
        { title: 'Action Plan', description: 'Execute the core requirements', completed: false, estimatedTime: 60, weightage: 100, order: 1 }
      ],
      estimatedEffort: 50,
      aiSuggestedPriority: 'Medium',
      aiSuggestedTimeBlock: '09:00-11:00',
      riskLevel: 25
    };
  }
}

/**
 * Time utility parsers for programmatic scheduling.
 */
function timeToMinutes(t: string): number {
  const [h, m] = (t || "09:00").split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mins = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Programmatic fallback for conflict-free hourly scheduling.
 */
function localPlanDailySchedule(
  tasks: Task[], 
  habits: Habit[], 
  calendarEvents: CalendarEvent[],
  workHoursStart: string,
  workHoursEnd: string
): Omit<ScheduleItem, 'id'>[] {
  const startMin = timeToMinutes(workHoursStart || '09:00');
  const endMin = timeToMinutes(workHoursEnd || '18:00');
  
  const busyIntervals = calendarEvents.map(e => ({
    start: timeToMinutes(e.startTime),
    end: timeToMinutes(e.endTime),
    title: e.title,
  })).sort((a, b) => a.start - b.start);

  const items: Omit<ScheduleItem, 'id'>[] = [];
  
  // Add meetings directly to schedule
  calendarEvents.forEach(e => {
    items.push({
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      type: 'meeting'
    });
  });

  let currentMin = startMin;

  const hasConflict = (start: number, end: number) => {
    return busyIntervals.some(b => !(end <= b.start || start >= b.end));
  };

  const findNextAvailableSlot = (duration: number): { start: number; end: number } | null => {
    let testStart = currentMin;
    while (testStart + duration <= endMin) {
      if (!hasConflict(testStart, testStart + duration)) {
        return { start: testStart, end: testStart + duration };
      }
      const conflict = busyIntervals.find(b => !(testStart + duration <= b.start || testStart >= b.end));
      if (conflict) {
        testStart = conflict.end;
      } else {
        testStart += 15;
      }
    }
    return null;
  };

  // Schedule up to 2 habits
  const habitsToSchedule = habits.slice(0, 2);
  for (const h of habitsToSchedule) {
    const slot = findNextAvailableSlot(30);
    if (slot) {
      items.push({
        title: `Routine Anchor: ${h.title}`,
        startTime: minutesToTime(slot.start),
        endTime: minutesToTime(slot.end),
        type: 'habit',
        referenceId: h.id
      });
      currentMin = slot.end;
    }
  }

  // Schedule non-completed tasks based on available time
  const activeTasks = tasks.filter(t => t.status !== 'Completed');
  for (const t of activeTasks) {
    const duration = Math.min(t.estimatedTime || 60, 90);
    const slot = findNextAvailableSlot(duration);
    if (slot) {
      items.push({
        title: `Focus Block: ${t.title}`,
        startTime: minutesToTime(slot.start),
        endTime: minutesToTime(slot.end),
        type: 'task',
        referenceId: t.id
      });
      currentMin = slot.end;

      // Add a break after task focus blocks
      const breakSlot = findNextAvailableSlot(15);
      if (breakSlot) {
        items.push({
          title: 'Socrates Re-energizing Break',
          startTime: minutesToTime(breakSlot.start),
          endTime: minutesToTime(breakSlot.end),
          type: 'break'
        });
        currentMin = breakSlot.end;
      }
    }
  }

  return items.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * 3. AI SMART SCHEDULER
 * Organizes tasks and habits hour-by-hour around existing calendar meetings.
 */
export async function planDailySchedule(
  tasks: Task[], 
  habits: Habit[], 
  calendarEvents: CalendarEvent[],
  workHoursStart: string,
  workHoursEnd: string
): Promise<Omit<ScheduleItem, 'id'>[]> {
  if (!isApiKeyConfigured()) {
    console.warn("Gemini API key is not configured. Falling back to rule-based scheduler.");
    return localPlanDailySchedule(tasks, habits, calendarEvents, workHoursStart, workHoursEnd);
  }

  try {
    const prompt = `Generate a modern, highly structured, conflict-free daily schedule between ${workHoursStart} and ${workHoursEnd}.
    
    Active Pending/In-Progress Tasks to schedule:
    ${JSON.stringify(tasks.filter(t => t.status !== 'Completed').map(t => ({ id: t.id, title: t.title, estimatedTime: t.estimatedTime, priority: t.priority })), null, 2)}
    
    Habits to anchor:
    ${JSON.stringify(habits.map(h => ({ id: h.id, title: h.title, category: h.category })), null, 2)}
    
    Existing Busy/Conflict Calendar Events:
    ${JSON.stringify(calendarEvents.map(e => ({ title: e.title, start: e.startTime, end: e.endTime })), null, 2)}`;

    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        systemInstruction: `You are a precision AI Scheduler. Allocate task slots and habit slots logically within the working hours.
        Ensure ZERO overlaps with existing calendar meetings (mark meetings as type 'meeting').
        Add short breaks (type 'break') after intense 90-minute tasks.
        Times must be strictly in HH:MM format. Output order should follow chronological start time.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              startTime: { type: Type.STRING, description: "Format HH:MM e.g. 09:30" },
              endTime: { type: Type.STRING, description: "Format HH:MM e.g. 11:00" },
              type: { type: Type.STRING, enum: ['task', 'meeting', 'break', 'habit'] },
              referenceId: { type: Type.STRING, description: "Associated Task or Habit ID if applicable." }
            },
            required: ['title', 'startTime', 'endTime', 'type']
          }
        }
      }
    });

    const text = response.text?.trim() || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Smart Scheduler failed entirely, falling back to rule-based scheduling:", error);
    return localPlanDailySchedule(tasks, habits, calendarEvents, workHoursStart, workHoursEnd);
  }
}

/**
 * 4. AI PRODUCTIVITY COACH CHAT & SUGGESTIONS
 * Dynamic response to user inquiries and automatic suggestion generator.
 */
export async function getCoachResponse(history: ChatMessage[], latestInput: string, userWorkload: Task[]): Promise<string> {
  const fallbackMessage = `I ran into a connection glitch, but my core advice remains: pick your top task, close all other browser tabs, set a 25-minute Pomodoro timer, and write the first line. You've got this! Currently, you have ${userWorkload.filter(t => t.status !== 'Completed').length} active tasks today. Let's make a plan to master them.`;
  
  if (!isApiKeyConfigured()) {
    return fallbackMessage;
  }

  const modelsToTry = [MODEL_NAME, 'gemini-1.5-flash-8b'];
  let lastError: any = null;

  const formattedHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.content }]
  }));

  const workloadContext = `User Current Workload Overview:
  ${JSON.stringify(userWorkload.map(t => ({ title: t.title, priority: t.priority, deadline: t.deadline, risk: `${t.deadlineRisk}%`, status: t.status })), null, 2)}`;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Attempting Coach response using ${model} (attempt ${attempt}/2)...`);
        const chat = ai.chats.create({
          model: model,
          history: formattedHistory,
          config: {
            systemInstruction: `You are "Socrates-Focus", an empathetic, elite-tier AI Productivity Coach for high-pressure professionals, researchers, and students.
            Your tone is highly motivational, clear, slightly challenging but deeply supportive (never dry or robotic).
            You do not just remind; you offer creative schedules, psychological hacks, diaphragmatic breathing cues, and focus routines.
            Always tailor recommendations based on the user's workload context.
            Keep answers conversational and structured with brief bullet points.`
          }
        });

        const response = await chat.sendMessage({
          message: `${workloadContext}\n\nUser Message: "${latestInput}"`
        });

        if (response.text) {
          return response.text;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Coach Chat via ${model} failed (attempt ${attempt}/2):`, error.message || error);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
    }
  }

  console.error("Gemini Coach Chat failed entirely, falling back to static prompt:", lastError);
  return fallbackMessage;
}

/**
 * Programmatic fallback for predictive alerts and coaching reminders.
 */
function localGenerateAIPredictiveSuggestions(tasks: Task[], habits: Habit[]): Omit<AISuggestion, 'id' | 'userId' | 'createdAt'>[] {
  const pendingTasks = tasks.filter(t => t.status !== 'Completed');
  const suggestions: Omit<AISuggestion, 'id' | 'userId' | 'createdAt'>[] = [];

  if (pendingTasks.length > 0) {
    const topTask = [...pendingTasks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))[0];
    suggestions.push({
      title: `Focus Target: ${topTask.title}`,
      suggestion: `Calculate deadline safety buffer. This high-priority task has an urgency risk score of ${topTask.deadlineRisk || 50}%. Socrates suggests tackling this first thing today.`,
      type: 'urgency_warning',
      actioned: false,
      taskId: topTask.id
    });
  } else {
    suggestions.push({
      title: "Inbox Zero Sustained",
      suggestion: "Magnificent! All pending critical deadlines have been secured. Use this window to anchor a healthy habit routine.",
      type: 'coach_motivation',
      actioned: false
    });
  }

  if (habits.length > 0) {
    const topHabit = [...habits].sort((a, b) => b.streaks - a.streaks)[0];
    suggestions.push({
      title: `Streak Preservation: ${topHabit.title}`,
      suggestion: `Anchor your ${topHabit.title} habit immediately. You are on an impressive ${topHabit.streaks}-day streak! Keep the focus flame alive.`,
      type: 'scheduler_reorg',
      actioned: false
    });
  } else {
    suggestions.push({
      title: "Anchor a Routine Catalyst",
      suggestion: "Establish at least one daily micro-habit (e.g., Diaphragmatic Breathing or a Coding review) to keep focus ratios high.",
      type: 'scheduler_reorg',
      actioned: false
    });
  }

  return suggestions;
}

/**
 * 5. SMART MOTIVATIONAL REMINDER GENERATOR
 * Generates highly context-specific urgent notification reminders based on tasks.
 */
export async function generateAIPredictiveSuggestions(tasks: Task[], habits: Habit[]): Promise<Omit<AISuggestion, 'id' | 'userId' | 'createdAt'>[]> {
  if (!isApiKeyConfigured()) {
    return localGenerateAIPredictiveSuggestions(tasks, habits);
  }

  try {
    const pendingTasks = tasks.filter(t => t.status !== 'Completed');
    const prompt = `Review the user's pending tasks and habits, and output exactly 2 highly customized, hyper-targeted AI coaching suggestions.
    
    Pending Tasks:
    ${JSON.stringify(pendingTasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline, estimatedTime: t.estimatedTime, risk: t.deadlineRisk, priority: t.priority })), null, 2)}
    
    Habits:
    ${JSON.stringify(habits.map(h => ({ title: h.title, category: h.category, streaks: h.streaks })), null, 2)}`;

    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        systemInstruction: `You are an elite productivity analysis engine. Generate EXACTLY two action-oriented notifications.
        One should be an 'urgency_warning' alerting the user with exact start times based on risk percentages (e.g. "You need 90 mins to complete X. Start within 20 mins to meet tomorrow's deadline comfortably.").
        The other should be a 'coach_motivation' or 'scheduler_reorg' habit trigger (e.g., "Anchor your Meditation habit immediately after your Standup meeting at 11:00 AM to reset cognitive load.").`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              suggestion: { type: Type.STRING, description: "Detailed motivational suggestion or precise warning." },
              type: { type: Type.STRING, enum: ['urgency_warning', 'breakdown', 'scheduler_reorg', 'coach_motivation'] },
              taskId: { type: Type.STRING, description: "Include relevant Task ID if this recommendation targets a specific task." }
            },
            required: ['title', 'suggestion', 'type']
          }
        }
      }
    });

    const text = response.text?.trim() || "[]";
    return JSON.parse(text).map((item: any) => ({
      ...item,
      actioned: false
    }));
  } catch (error) {
    console.error("Gemini Suggestions Generator failed entirely, falling back to rule-based suggestion generator:", error);
    return localGenerateAIPredictiveSuggestions(tasks, habits);
  }
}

/**
 * Programmatic fallback for lightweight predictive analytics used when Gemini is unavailable.
 */
function localGeneratePredictions(tasks: Task[], habits: Habit[], calendarEvents: CalendarEvent[]): Prediction {
  const pending = tasks.filter(t => t.status !== 'Completed');
  const totalWorkMins = pending.reduce((s, t) => s + (t.estimatedTime || 0), 0);
  const highRiskCount = pending.filter(t => (t.deadlineRisk || 0) > 70).length;

  const estimatedSuccessRate = Math.max(20, 100 - highRiskCount * 15 - Math.min(50, totalWorkMins / 60));
  const completionProbability = Math.min(95, estimatedSuccessRate - (pending.length > 5 ? 10 : 0));
  const burnoutProbability = Math.min(90, Math.round(Math.max(0, totalWorkMins - 240) / 5));

  return {
    estimatedSuccessRate,
    completionProbability,
    todayCompletionChance: Math.max(10, completionProbability - 10),
    tomorrowWorkloadMinutes: Math.round(totalWorkMins * 0.6),
    weeklyCompletionChance: Math.max(10, estimatedSuccessRate - 5),
    burnoutProbability,
    deadlineFailureProbability: Math.min(95, highRiskCount * 20),
    recommendedSleepHours: burnoutProbability > 50 ? 8 : 7,
    recommendedBreakFrequency: burnoutProbability > 50 ? 'Every 40 minutes' : 'Every 60 minutes',
    recommendedFocusDuration: burnoutProbability > 50 ? 25 : 45,
    bestFocusWindow: 'Morning (09:00-12:00)',
    explanation: `Local heuristic: ${pending.length} pending tasks, ${totalWorkMins} total estimated minutes, ${highRiskCount} high-risk tasks detected.`
  };
}

/**
 * 6. PREDICTION & SIMULATION ENGINE
 * Provides workload predictions and what-if simulations.
 */
export async function generatePredictions(tasks: Task[], habits: Habit[], calendarEvents: CalendarEvent[]): Promise<Prediction> {
  if (!isApiKeyConfigured()) {
    return localGeneratePredictions(tasks, habits, calendarEvents);
  }

  try {
    const prompt = `Produce a compact JSON prediction about the user's workload for today and next week.
Tasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, estimatedTime: t.estimatedTime, deadlineRisk: t.deadlineRisk, status: t.status })), null, 2)}
Habits: ${JSON.stringify(habits.map(h => ({ title: h.title, streaks: h.streaks })), null, 2)}
Calendar Events: ${JSON.stringify(calendarEvents.map(c => ({ title: c.title, start: c.startTime, end: c.endTime })), null, 2)}`;

    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        systemInstruction: 'Return a single JSON object matching the Prediction type with concise explanations.',
        responseMimeType: 'application/json'
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return parsed as Prediction;
  } catch (error) {
    console.error('Gemini Prediction engine failed, using local heuristic:', error);
    return localGeneratePredictions(tasks, habits, calendarEvents);
  }
}

/**
 * Lightweight what-if simulator fallback.
 */
function localSimulateWhatIf(tasks: Task[], changes: any): { predictedChange: Partial<Prediction>; notes: string } {
  // Very simple simulation: if work hours reduced, completion probability drops proportionally
  const reduction = changes.workHoursReductionPercent || 0;
  const predicted: Partial<Prediction> = {
    completionProbability: Math.max(5, 80 - reduction),
    todayCompletionChance: Math.max(5, 70 - reduction),
    burnoutProbability: Math.min(95, reduction / 2 + 10)
  };
  return { predictedChange: predicted, notes: `Applied local reduction ${reduction}%` };
}

/**
 * 7. WHAT-IF SIMULATOR
 */
export async function simulateWhatIf(tasks: Task[], habits: Habit[], calendarEvents: CalendarEvent[], changes: any): Promise<{ predictedChange: Partial<Prediction>; notes: string }> {
  if (!isApiKeyConfigured()) {
    return localSimulateWhatIf(tasks, changes);
  }

  try {
    const prompt = `Simulate the effect of these hypothetical changes on the user's current workload:

    Current Tasks:
    ${JSON.stringify(tasks.map(t => ({ title: t.title, estimatedTime: t.estimatedTime, risk: t.deadlineRisk, status: t.status })), null, 2)}

    Current Habits:
    ${JSON.stringify(habits.map(h => ({ title: h.title, streaks: h.streaks })), null, 2)}

    Proposed Changes to Simulate:
    ${JSON.stringify(changes, null, 2)}

    Provide a JSON with predictedChange (partial Prediction) and a short notes string explaining the impact.`;

    const response = await safeGenerateContent({
      contents: prompt,
      config: {
        systemInstruction: 'You are a Workload Simulation Engine. Analyze how the proposed changes (e.g. reduced hours, added tasks, shift in priorities) would impact the user\'s predicted success and burnout risk based on their current workload. Return a JSON object: { predictedChange: {...}, notes: "" }',
        responseMimeType: 'application/json'
      }
    });
    const text = response.text?.trim() || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini What-If simulation failed, using local fallback:', error);
    return localSimulateWhatIf(tasks, changes);
  }
}

/**
 * 8. GOAL PLANNER
 * Create a goal->milestone->task mapping plan.
 */
export async function createGoalPlan(goal: Goal, milestones: Milestone[], tasks: Task[]): Promise<{ milestones: Milestone[]; recommendedTaskMap: Record<string, string[]> }>{
  // Simple local planner: map tasks by title keywords to milestone titles
  const recommendedTaskMap: Record<string, string[]> = {};
  for (const m of milestones) {
    recommendedTaskMap[m.id] = [];
  }

  for (const t of tasks) {
    const matched = milestones.find(m => t.title.toLowerCase().includes(m.title.toLowerCase().split(' ')[0]));
    if (matched) recommendedTaskMap[matched.id].push(t.id);
    else if (milestones[0]) recommendedTaskMap[milestones[0].id].push(t.id);
  }

  return { milestones, recommendedTaskMap };
}

/**
 * 9. EMERGENCY RESCUE MODE
 * Quickly triage and produce an executable rescue plan.
 */
export async function runEmergencyRescue(
  tasks: Task[],
  calendarEvents: CalendarEvent[],
  habits: Habit[],
  availableHours: number = 4,
  customMeetings: string[] = [],
  customDeadlines: string[] = []
): Promise<{ plan: string[]; immediateSchedule: Omit<ScheduleItem, 'id'>[] }> {
  if (isApiKeyConfigured()) {
    try {
      const prompt = `EMERGENCY RESCUE MODE: The user has only ${availableHours} hours left and is overwhelmed.
      Create a "Rescue Plan" consisting of 3-5 high-level strategy steps and a minute-by-minute schedule.

      Tasks to rescue (already prioritized/filtered):
      ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, estimatedTime: t.estimatedTime, risk: t.deadlineRisk, priority: t.priority })), null, 2)}

      Existing Calendar Meetings:
      ${JSON.stringify(calendarEvents.map(e => ({ title: e.title, start: e.startTime, end: e.endTime })), null, 2)}

      Custom Manual Meetings/Deadlines provided by user:
      Meetings: ${customMeetings.join(', ')}
      Deadlines: ${customDeadlines.join(', ')}`;

      const response = await safeGenerateContent({
        contents: prompt,
        config: {
          systemInstruction: `You are an Emergency Triage AI. Your goal is to salvage the day.
          Be ruthless: deprioritize non-essential work, suggest moving meetings if possible, and focus on the absolute critical path.
          The 'plan' should be an array of strategic strings.
          The 'immediateSchedule' should be an array of schedule items fitting within the ${availableHours} hour window.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plan: { type: Type.ARRAY, items: { type: Type.STRING } },
              immediateSchedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['task', 'meeting', 'break', 'habit'] },
                    referenceId: { type: Type.STRING }
                  },
                  required: ['title', 'startTime', 'endTime', 'type']
                }
              }
            },
            required: ['plan', 'immediateSchedule']
          }
        }
      });

      const text = response.text?.trim() || "{}";
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Rescue Mode failed, using local triage:", error);
    }
  }

  // Local Triage Heuristic
  const urgent = [...tasks].sort((a,b) => (b.deadlineRisk||0)-(a.deadlineRisk||0));
  const plan: string[] = [
    "Stop all non-essential communications (Slack/Email).",
    "Focus only on the selected high-risk items.",
    "Use 50/10 Pomodoro cycles to maintain intensity."
  ];

  const schedule: Omit<ScheduleItem, 'id'>[] = [];
  let currentMin = timeToMinutes(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
  if (isNaN(currentMin)) currentMin = 540; // Default to 9 AM if time parsing fails

  let remainingMins = availableHours * 60;

  for (const t of urgent) {
    if (remainingMins <= 15) break;
    const duration = Math.min(t.estimatedTime || 45, remainingMins - 10);

    schedule.push({
      title: `Rescue Focus: ${t.title}`,
      startTime: minutesToTime(currentMin),
      endTime: minutesToTime(currentMin + duration),
      type: 'task',
      referenceId: t.id
    });

    currentMin += duration;
    remainingMins -= duration;

    if (remainingMins > 10) {
      schedule.push({
        title: 'Micro Recovery',
        startTime: minutesToTime(currentMin),
        endTime: minutesToTime(currentMin + 5),
        type: 'break'
      });
      currentMin += 5;
      remainingMins -= 5;
    }
  }

  return { plan, immediateSchedule: schedule };
}

/**
 * 10. EXECUTIVE CONSISTENCY METRICS
 */
export async function computeConsistencyMetrics(tasks: Task[], habits: Habit[], analytics: any[]): Promise<ConsistencyMetrics> {
  const streak = habits.reduce((s,h)=> Math.max(s, h.streaks||0), 0);
  const weeklyConsistency = Math.min(100, streak * 5 + 40);
  const monthlyConsistency = Math.min(100, streak * 4 + 30);
  const focusTrend = weeklyConsistency > 70 ? 'Improving' : (weeklyConsistency > 45 ? 'Stable' : 'Declining');
  const goalCompletionRate = analytics && analytics.length ? Math.round((analytics.reduce((s,a:any)=>s+(a.tasksCompleted||0),0) / Math.max(1, analytics.reduce((s,a:any)=>s+(a.tasksCompleted||0)+(a.tasksMissed||0),0))) * 100) : 50;

  return {
    currentStreak: streak,
    weeklyConsistency,
    monthlyConsistency,
    focusTrend,
    goalCompletionRate,
    aiProductivityScore: Math.round((weeklyConsistency + goalCompletionRate) / 2),
    burnoutLevel: Math.max(5, 100 - weeklyConsistency),
    weeklyHeatmap: [],
    monthlyHeatmap: [],
    taskTimeline: [],
    progressRings: [
      { label: 'Weekly Consistency', value: weeklyConsistency, description: 'How consistent you were this week' },
      { label: 'Goal Completion', value: goalCompletionRate, description: 'Goals completed rate' }
    ]
  };
}

/**
 * 2. TASK AUTOMATIC BREAKDOWN ENGINE
 */
export async function generateSubtasks(taskTitle: string, taskDescription: string): Promise<Omit<Subtask, 'id' | 'taskId'>[]> {
  const result = await analyzeAndEnhanceTask(taskTitle, taskDescription);
  return result.subtasks;
}
/**
 * 11. AI EXPLANATION PANEL
 * Produce concise explanations for a task decision.
 */
export async function explainTaskDecision(task: Task, context: { nearbyTasks?: Task[]; calendar?: CalendarEvent[] }): Promise<string> {
  if (!isApiKeyConfigured()) {
    return `Local explanation: Task "${task.title}" has priority ${task.priority} with deadline risk ${task.deadlineRisk || 0}%. Estimated time ${task.estimatedTime} minutes.`;
  }

  try {
    const prompt = `Explain why task '${task.title}' was assigned priority ${task.priority} and risk ${task.deadlineRisk || 0} in one concise paragraph. Context: ${JSON.stringify(context)}`;
    const response = await safeGenerateContent({
      contents: prompt,
      config: { systemInstruction: 'Provide a single paragraph explanation.', responseMimeType: 'text/plain' }
    });
    return response.text?.trim() || '';
  } catch (error) {
    console.error('Gemini explanation failed, returning local summary:', error);
    return `Local explanation: Task "${task.title}" has priority ${task.priority} with deadline risk ${task.deadlineRisk || 0}%.`;
  }
}


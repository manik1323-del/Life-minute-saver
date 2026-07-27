import { describe, it, expect, vi } from 'vitest';
import * as ai from './ai';
import { Task, Habit, CalendarEvent, Goal, Milestone } from '../src/types';

describe('AI Engine Logic', () => {
  const mockTasks: Task[] = [
    {
      id: 't1',
      userId: 'u1',
      title: 'Overdue Task',
      description: '',
      deadline: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      priority: 'High',
      estimatedTime: 60,
      category: 'Work',
      tags: [],
      status: 'Pending',
      difficulty: 'Medium',
      progress: 0,
      priorityScore: 0,
      deadlineRisk: 0,
      missedTaskHistory: false,
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 't2',
      userId: 'u1',
      title: 'Upcoming Task',
      description: '',
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
      priority: 'Low',
      estimatedTime: 30,
      category: 'Personal',
      tags: [],
      status: 'Pending',
      difficulty: 'Easy',
      progress: 0,
      priorityScore: 0,
      deadlineRisk: 0,
      missedTaskHistory: false,
      createdAt: '',
      updatedAt: ''
    }
  ];

  const mockHabits: Habit[] = [
    { id: 'h1', userId: 'u1', title: 'Meditation', category: 'Health', frequency: 'Daily', streaks: 10, history: [], createdAt: '' }
  ];

  const mockEvents: CalendarEvent[] = [
    { id: 'e1', userId: 'u1', title: 'Meeting', startTime: '10:00', endTime: '11:00', source: 'local', conflictDetected: false }
  ];

  describe('Prioritization', () => {
    it('should assign Critical priority to overdue tasks in local fallback', async () => {
      const scores = await ai.prioritizeTasks([mockTasks[0]], []);
      expect(scores[0].priority).toBe('Critical');
      expect(scores[0].deadlineRisk).toBe(100);
    });

    it('should assign Low priority to distant tasks in local fallback', async () => {
      const scores = await ai.prioritizeTasks([mockTasks[1]], []);
      expect(scores[0].priority).toBe('Low');
      expect(scores[0].deadlineRisk).toBeLessThan(50);
    });
  });

  describe('Scheduling', () => {
    it('should handle empty lists gracefully', async () => {
      const schedule = await ai.planDailySchedule([], [], [], '09:00', '18:00');
      expect(schedule).toEqual([]);
    });

    it('should avoid meeting conflicts in local schedule', async () => {
      const eventsWithISO = [
        { ...mockEvents[0], startTime: '2026-07-02T10:00:00Z', endTime: '2026-07-02T11:00:00Z' }
      ];
      const schedule = await ai.planDailySchedule(mockTasks, mockHabits, eventsWithISO as any, '09:00', '12:00');

      const meeting = schedule.find(i => i.type === 'meeting');
      expect(meeting).toBeDefined();

      const taskBlock = schedule.find(i => i.type === 'task');
      if (taskBlock) {
        const start = taskBlock.startTime;
        const end = taskBlock.endTime;
        const isOverlapping = (s: string, e: string) => !(e <= '10:00' || s >= '11:00');
        expect(isOverlapping(start, end)).toBe(false);
      }
    });
  });

  describe('Predictions & Simulations', () => {
    it('should generate predictions with high success for low workload', async () => {
      const pred = await ai.generatePredictions([mockTasks[1]], [], []);
      expect(pred.estimatedSuccessRate).toBeGreaterThan(70);
    });

    it('should simulate work hour reduction impact', async () => {
      const res = await ai.simulateWhatIf(mockTasks, mockHabits, mockEvents, { workHoursReductionPercent: 50 });
      expect(res.predictedChange.completionProbability).toBeLessThan(80);
      expect(res.predictedChange.burnoutProbability).toBeGreaterThan(10);
    });
  });

  describe('Goal Planning', () => {
    it('should map tasks to milestones by title keywords', async () => {
      const goal: Goal = { id: 'g1', userId: 'u1', title: 'Goal', description: '', status: 'Active', progress: 0, createdAt: '' };
      const milestones: Milestone[] = [
        { id: 'm1', userId: 'u1', goalId: 'g1', title: 'Overdue Phase', description: '', taskIds: [], status: 'Pending', createdAt: '' }
      ];
      const plan = await ai.createGoalPlan(goal, milestones, mockTasks);
      expect(plan.recommendedTaskMap['m1']).toContain('t1');
    });
  });

  describe('Emergency Rescue', () => {
    it('should prioritize urgent tasks in rescue plan', async () => {
      const rescue = await ai.runEmergencyRescue(mockTasks, [], []);
      expect(rescue.immediateSchedule[0].referenceId).toBe('t1');
    });
  });

  describe('Explanations', () => {
    it('should provide local explanation when API is missing', async () => {
      const exp = await ai.explainTaskDecision(mockTasks[0], {});
      expect(exp).toContain('Overdue Task');
      expect(exp).toContain('High');
    });
  });
});

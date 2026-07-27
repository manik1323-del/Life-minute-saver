import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { readDb, writeDb, seedUserData } from './db';

vi.mock('fs', () => {
  const mockFs = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

describe('Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read from database file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ users: [], tasks: [] }));

    const db = readDb();
    expect(db.users).toEqual([]);
    expect(fs.readFileSync).toHaveBeenCalled();
  });

  it('should write to database file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const mockDb: any = { users: [], tasks: [] };

    writeDb(mockDb);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should seed user data', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      users: [], tasks: [], habits: [], subtasks: [],
      calendarEvents: [], schedules: [], analytics: [],
      aiSuggestions: [], notifications: [], projects: [],
      chatMessages: {}, goals: [], milestones: [], predictions: [],
      consistencySnapshots: [], simulationHistory: [], recoveryPlans: [],
      organizations: [], teams: [], comments: [], reactions: [],
      activityLogs: [], invitations: [], workloadRecommendations: []
    }));

    seedUserData('test-user');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});

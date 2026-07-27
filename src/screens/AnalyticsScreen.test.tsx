import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AnalyticsScreen from './AnalyticsScreen';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../lib/api');
vi.mock('../contexts/AuthContext');

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { streakCount: 5 } } as any);
    vi.mocked(api.getAnalytics).mockResolvedValue([]);
    vi.mocked(api.getTasks).mockResolvedValue([]);
    vi.mocked(api.getConsistency).mockResolvedValue({ aiProductivityScore: 88 } as any);
    vi.mocked(api.getWorkspaceTeamSummary).mockResolvedValue({ teams: [], projects: [] });
    vi.mocked(api.getDailyStandup).mockResolvedValue([]);
    vi.mocked(api.getWorkspaceMembers).mockResolvedValue([]);
  });

  it('should render productivity stats', async () => {
    render(<AnalyticsScreen />);

    await waitFor(() => {
      expect(screen.getByText('88')).toBeInTheDocument();
    });
  });
});

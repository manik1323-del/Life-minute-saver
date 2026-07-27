import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardScreen from './DashboardScreen';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../lib/api');
vi.mock('../contexts/AuthContext');

describe('DashboardScreen', () => {
  const mockUser = { name: 'Test User' };
  const mockTasks = [
    { id: 't1', title: 'Task 1', status: 'Pending', priority: 'High', deadlineRisk: 20, estimatedTime: 30 }
  ];

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    vi.mocked(api.getSchedule).mockResolvedValue({ items: [] } as any);
    vi.mocked(api.getAISuggestions).mockResolvedValue([]);
    vi.mocked(api.getNotifications).mockResolvedValue([]);
    vi.mocked(api.getAnalytics).mockResolvedValue([]);
    vi.mocked(api.getPredictions).mockResolvedValue({
      estimatedSuccessRate: 85,
      explanation: 'Good',
      recommendedBreakFrequency: 'Every 60 minutes'
    } as any);
    vi.mocked(api.getConsistency).mockResolvedValue({ weeklyConsistency: 90, focusTrend: 'Up' } as any);
    vi.mocked(api.getGoals).mockResolvedValue({ goals: [], milestones: [] } as any);
  });

  it('should render welcome message and AI stats', async () => {
    render(<DashboardScreen onNavigate={() => {}} tasks={mockTasks as any} onRefreshTasks={() => {}} />);

    expect(screen.getByText(/Welcome back,/)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  it('should trigger AI Smart Re-Schedule on button click', async () => {
    vi.mocked(api.runAISmartScheduler).mockResolvedValue({ success: true, schedule: { items: [] } } as any);

    render(<DashboardScreen onNavigate={() => {}} tasks={mockTasks as any} onRefreshTasks={() => {}} />);

    fireEvent.click(screen.getByText('AI Smart Re-Schedule'));

    await waitFor(() => {
      expect(api.runAISmartScheduler).toHaveBeenCalled();
    });
  });
});

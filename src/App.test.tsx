import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { api } from './lib/api';

vi.mock('./lib/api');
vi.mock('./lib/socket', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  },
  initRealtimeConnection: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true
  })),
  joinRealtimeRooms: vi.fn(),
  leaveRealtimeRooms: vi.fn(),
  disconnectRealtime: vi.fn()
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render loading state initially', async () => {
    localStorage.setItem('last_minute_token', 'valid');
    // Mock getMe to stay pending
    vi.mocked(api.getMe).mockReturnValue(new Promise(() => {}));

    render(<App />);
    expect(screen.getByText(/Calibrating Focus Workspace/i)).toBeInTheDocument();
  });

  it('should render AuthScreen when not authenticated', async () => {
    vi.mocked(api.getMe).mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Enter Focus Workspace/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should render main app layout when authenticated', async () => {
    localStorage.setItem('last_minute_token', 'valid');
    vi.mocked(api.getMe).mockResolvedValue({ id: 'u1', name: 'Test Automation', theme: 'dark' } as any);
    vi.mocked(api.getTasks).mockResolvedValue([]);
    vi.mocked(api.getNotifications).mockResolvedValue([]);
    vi.mocked(api.getSchedule).mockResolvedValue({ items: [] } as any);
    vi.mocked(api.getAISuggestions).mockResolvedValue([]);
    vi.mocked(api.getAnalytics).mockResolvedValue([]);
    vi.mocked(api.getPredictions).mockResolvedValue({ estimatedSuccessRate: 100, explanation: '', recommendedBreakFrequency: '60m' } as any);
    vi.mocked(api.getConsistency).mockResolvedValue({ weeklyConsistency: 100, focusTrend: '' } as any);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
      // Use getAllByText and check for at least one
      expect(screen.getAllByText(/Test Automation/i)[0]).toBeInTheDocument();
    }, { timeout: 20000 });
  }, 30000);
});

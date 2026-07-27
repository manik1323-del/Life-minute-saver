import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FocusScreen from './FocusScreen';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext');

describe('FocusScreen', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { focusPeriod: 25 } } as any);
    vi.useFakeTimers();
  });

  it('should start and pause timer', async () => {
    render(<FocusScreen />);

    expect(screen.getByText('25:00')).toBeInTheDocument();

    const startBtn = screen.getByText('Initiate Focus');
    fireEvent.click(startBtn);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('24:59')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pause Timer'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('24:59')).toBeInTheDocument();
  });

  it('should toggle breathing guide', () => {
    render(<FocusScreen />);

    const breathBtn = screen.getByText(/Activate Diaphragmatic/);
    fireEvent.click(breathBtn);

    expect(screen.getByText('In')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Deactivate Breathing Helper'));
    expect(screen.queryByText('In')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoalsScreen from './GoalsScreen';
import { api } from '../lib/api';

vi.mock('../lib/api');

describe('GoalsScreen', () => {
  beforeEach(() => {
    vi.mocked(api.getGoals).mockResolvedValue({ goals: [], milestones: [] });
  });

  it('should create a goal successfully', async () => {
    render(<GoalsScreen onRefreshTasks={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Launch portfolio/), { target: { value: 'Test Goal' } });
    fireEvent.click(screen.getByText('Add Goal'));

    await waitFor(() => {
      expect(api.createGoal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test Goal' }));
    });
  });
});

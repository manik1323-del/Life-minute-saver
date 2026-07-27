import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TasksScreen from './TasksScreen';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../lib/api');
vi.mock('../contexts/AuthContext');

describe('TasksScreen', () => {
  const mockTasks = [
    {
      id: 't1',
      title: 'Active Task',
      description: 'Desc',
      status: 'Pending',
      priority: 'High',
      category: 'Work',
      deadline: new Date().toISOString(),
      estimatedTime: 60,
      deadlineRisk: 10,
      tags: ['test']
    }
  ];

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'User' } } as any);
    vi.mocked(api.getWorkspaceMembers).mockResolvedValue([]);
    vi.mocked(api.getSubtasks).mockResolvedValue([]);
    vi.mocked(api.getWorkspaceComments).mockResolvedValue([]);
    vi.mocked(api.getWorkspaceReactions).mockResolvedValue([]);
  });

  it('should render tasks and handle expansion', async () => {
    render(<TasksScreen tasks={mockTasks as any} onRefreshTasks={() => {}} />);

    expect(screen.getByText('Active Task')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Active Task'));

    await waitFor(() => {
      expect(api.getSubtasks).toHaveBeenCalledWith('t1');
    });
  });

  it('should open create modal and call createTask', async () => {
    render(<TasksScreen tasks={[]} onRefreshTasks={() => {}} />);

    fireEvent.click(screen.getByText('New Task'));

    expect(screen.getByText('Create New Focus Task')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Draft Executive/), { target: { value: 'New Test Task' } });
    fireEvent.click(screen.getByText('Initiate High-Output Task'));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Test Task' }));
    });
  });
});

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkspaceScreen from './WorkspaceScreen';
import { api } from '../lib/api';

vi.mock('../lib/api');

describe('WorkspaceScreen', () => {
  beforeEach(() => {
    vi.mocked(api.getOrganizations).mockResolvedValue([]);
    vi.mocked(api.getTeams).mockResolvedValue([]);
    vi.mocked(api.getProjects).mockResolvedValue([]);
    vi.mocked(api.getWorkspaceActivity).mockResolvedValue([]);
    vi.mocked(api.getWorkspaceMembers).mockResolvedValue([]);
  });

  it('should render and create organization', async () => {
    const mockOrg = {
      id: 'o1',
      name: 'New Org',
      description: 'Desc',
      memberIds: ['u1'],
      teamIds: [],
      projectIds: [],
      ownerId: 'u1',
      createdAt: new Date().toISOString()
    };
    vi.mocked(api.createOrganization).mockResolvedValue(mockOrg as any);

    render(<WorkspaceScreen />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/Fetching organizations/i)).not.toBeInTheDocument());

    const input = screen.getByPlaceholderText(/New organization name/);
    fireEvent.change(input, { target: { value: 'New Org' } });

    const createBtn = screen.getByRole('button', { name: /New organization/i });

    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => {
      expect(api.createOrganization).toHaveBeenCalledWith('New Org', '');
    });

    // Check if it appears in the list
    expect(await screen.findByText('New Org')).toBeInTheDocument();
    // Check if count updated
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

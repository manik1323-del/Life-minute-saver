import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CoachScreen from './CoachScreen';
import { api } from '../lib/api';

vi.mock('../lib/api');

// Mock window.HTMLElement.prototype.scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('CoachScreen', () => {
  beforeEach(() => {
    vi.mocked(api.getCoachHistory).mockResolvedValue([]);
  });

  it('should send a message and display response', async () => {
    vi.mocked(api.sendCoachMessage).mockResolvedValue({
      message: { id: 'm1', role: 'model', content: 'Coach Response', createdAt: new Date().toISOString() },
      history: [
        { id: 'u1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
        { id: 'm1', role: 'model', content: 'Coach Response', createdAt: new Date().toISOString() }
      ]
    });

    render(<CoachScreen />);

    const input = screen.getByPlaceholderText(/Formulate query/);
    fireEvent.change(input, { target: { value: 'Hello' } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'));
    });

    await waitFor(() => {
      expect(screen.getByText('Coach Response')).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsScreen from './SettingsScreen';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext');

describe('SettingsScreen', () => {
  const mockUser = {
    name: 'Original Name',
    workHoursStart: '09:00',
    workHoursEnd: '18:00',
    focusPeriod: 25,
    theme: 'dark',
    googleCalendarLinked: false
  };

  const mockUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      updateSettings: mockUpdateSettings,
      applyTheme: vi.fn(),
    } as any);
  });

  it('should render user settings correctly', () => {
    render(<SettingsScreen />);
    expect(screen.getByDisplayValue('Original Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
  });

  it('should validate time format before saving', async () => {
    render(<SettingsScreen />);
    const nameInput = screen.getByDisplayValue('Original Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    const startInput = screen.getByDisplayValue('09:00');
    fireEvent.change(startInput, { target: { value: 'invalid' } });

    fireEvent.click(screen.getByText('Save Configuration'));

    expect(await screen.findByText(/must be in HH:MM format/)).toBeInTheDocument();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('should call updateSettings with new values on valid form submission', async () => {
    render(<SettingsScreen />);
    const nameInput = screen.getByDisplayValue('Original Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Name'
      }));
    });
  });

  it('should toggle theme preview locally', () => {
    render(<SettingsScreen />);
    const lightModeBtn = screen.getByText('Modern Light Mode');
    fireEvent.click(lightModeBtn);

    expect(window.document.documentElement.classList.contains('dark')).toBe(false);
  });
});

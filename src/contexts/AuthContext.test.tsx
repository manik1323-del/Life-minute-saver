import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '../lib/api';

vi.mock('../lib/api');

const TestComponent = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-name">{user?.name}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with not authenticated state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
  });

  it('should restore session from localStorage', async () => {
    localStorage.setItem('last_minute_token', 'valid-token');
    const mockUser = { id: 'u1', name: 'Test User', theme: 'dark' };
    vi.mocked(api.getMe).mockResolvedValue(mockUser as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });
  });

  it('should handle login successfully', async () => {
    const mockResult = {
      token: 'new-token',
      refreshToken: 'ref-token',
      user: { id: 'u1', name: 'New User', theme: 'light' }
    };
    vi.mocked(api.login).mockResolvedValue(mockResult as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(localStorage.getItem('last_minute_token')).toBe('new-token');
    });
  });

  it('should handle logout', async () => {
    localStorage.setItem('last_minute_token', 'valid-token');
    vi.mocked(api.getMe).mockResolvedValue({ id: 'u1', name: 'User', theme: 'dark' } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    expect(localStorage.getItem('last_minute_token')).toBeNull();
  });
});

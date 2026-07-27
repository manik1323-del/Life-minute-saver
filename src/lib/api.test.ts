import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

global.fetch = vi.fn();

describe('API Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should include Authorization header when token exists', async () => {
    localStorage.setItem('last_minute_token', 'mock-token');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'u1' })
    } as any);

    await api.getMe();

    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer mock-token'
      })
    }));
  });

  it('should handle token refresh on 401', async () => {
    localStorage.setItem('last_minute_token', 'old-token');
    localStorage.setItem('last_minute_refresh_token', 'refresh-token');

    // First call returns 401
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 401,
      ok: false
    } as any);

    // Refresh call returns 200
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'new-token' })
    } as any);

    // Retried call returns 200
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'u1' })
    } as any);

    await api.getMe();

    expect(localStorage.getItem('last_minute_token')).toBe('new-token');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

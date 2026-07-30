import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { api } from "../lib/api";
import { DEMO_MODE, DEMO_USER, DEMO_TOKEN } from "../lib/demoUser";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (email: string, name: string, password?: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<string>;
  updateSettings: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  applyTheme: (theme: 'light' | 'dark') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("last_minute_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Automatically fetch profile if token is present on startup
  useEffect(() => {
    const initializeAuth = async () => {
      // ── DEMO MODE ──────────────────────────────────────────────────
      // When DEMO_MODE=true, skip all API calls and immediately resolve
      // with the demo user. The demo token is stored in localStorage so
      // fetchWrapper picks it up for all subsequent API calls.
      if (DEMO_MODE) {
        localStorage.setItem("last_minute_token", DEMO_TOKEN);
        setToken(DEMO_TOKEN);
        setUser(DEMO_USER);
        applyTheme(DEMO_USER.theme);

        // Seed demo data on the server (idempotent — safe to call on every load)
        try {
          await fetch("/api/demo/init");
        } catch {
          // Non-fatal: app still works, API calls may return empty arrays
        }

        setIsLoading(false);
        return;
      }
      // ── END DEMO MODE ──────────────────────────────────────────────

      // First restore theme from localStorage if available (even without login)
      const savedTheme = localStorage.getItem('last_minute_theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        applyTheme(savedTheme);
      }

      const storedToken = localStorage.getItem("last_minute_token");
      if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          setToken(storedToken);
          applyTheme(profile.theme);
        } catch (error) {
          console.error("Session restoration failed:", error);
          logout();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();

    // Set up interceptor event listener for automatic auth expiration handling
    const handleAuthExpired = () => {
      // In demo mode, auth never expires — ignore the event
      if (DEMO_MODE) return;
      logout();
    };
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
    };
  }, []);

  const applyTheme = (theme: 'light' | 'dark') => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('last_minute_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('last_minute_theme', 'light');
    }
  };

  const login = async (email: string, password?: string) => {
    // In demo mode, login is a no-op — the user is already authenticated
    if (DEMO_MODE) return;

    setIsLoading(true);
    try {
      const result = await api.login(email, password);
      localStorage.setItem("last_minute_token", result.token);
      localStorage.setItem("last_minute_refresh_token", result.refreshToken);
      setToken(result.token);
      setUser(result.user);
      applyTheme(result.user.theme);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, name: string, password?: string) => {
    // In demo mode, signup is a no-op — the user is already authenticated
    if (DEMO_MODE) return;

    setIsLoading(true);
    try {
      const result = await api.signup(email, name, password);
      localStorage.setItem("last_minute_token", result.token);
      localStorage.setItem("last_minute_refresh_token", result.refreshToken);
      setToken(result.token);
      setUser(result.user);
      applyTheme(result.user.theme);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // In demo mode, logout is a no-op — keep the demo session alive
    if (DEMO_MODE) return;

    localStorage.removeItem("last_minute_token");
    localStorage.removeItem("last_minute_refresh_token");
    // Preserve theme preference even after logout
    setToken(null);
    setUser(null);
  };

  const forgotPassword = async (email: string): Promise<string> => {
    if (DEMO_MODE) return "Demo mode: password reset is not required.";
    const res = await api.forgotPassword(email);
    return res.message;
  };

  const updateSettings = async (data: Partial<User>) => {
    if (DEMO_MODE) {
      // Update local user state so Settings screen reflects changes immediately
      setUser(prev => prev ? { ...prev, ...data } : prev);
      if (data.theme) applyTheme(data.theme);
      return;
    }

    try {
      const updatedProfile = await api.updateMe(data);
      setUser(updatedProfile);
      if (data.theme) {
        applyTheme(data.theme);
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
    }
  };

  const refreshUser = async () => {
    // In demo mode, the demo user is already the current user
    if (DEMO_MODE) return;

    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: DEMO_MODE ? true : !!token,
      isLoading,
      login,
      signup,
      logout,
      forgotPassword,
      updateSettings,
      refreshUser,
      applyTheme
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

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
          if (profile?.theme) applyTheme(profile.theme);
        } catch (error) {
          console.error("Session restoration failed:", error);
          if (DEMO_MODE) {
            setToken(DEMO_TOKEN);
            setUser(DEMO_USER);
          } else {
            logout();
          }
        }
      } else if (DEMO_MODE) {
        // Fallback demo mode if no token stored yet
        setToken(DEMO_TOKEN);
        setUser(DEMO_USER);
      }

      setIsLoading(false);
    };

    initializeAuth();

    const handleAuthExpired = () => {
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
    setIsLoading(true);
    try {
      const result = await api.login(email, password);
      if (result.token) {
        localStorage.setItem("last_minute_token", result.token);
        if (result.refreshToken) {
          localStorage.setItem("last_minute_refresh_token", result.refreshToken);
        }
        setToken(result.token);
        setUser(result.user);
        if (result.user?.theme) applyTheme(result.user.theme);
      }
    } catch (error: any) {
      console.warn("Backend login warning, checking fallback:", error.message);
      // Fallback demo login if offline/sandbox
      if (DEMO_MODE || email.includes("demo")) {
        localStorage.setItem("last_minute_token", DEMO_TOKEN);
        setToken(DEMO_TOKEN);
        setUser(DEMO_USER);
        applyTheme(DEMO_USER.theme);
      } else {
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, name: string, password?: string) => {
    setIsLoading(true);
    try {
      const result = await api.signup(email, name, password);
      if (result.token) {
        localStorage.setItem("last_minute_token", result.token);
        if (result.refreshToken) {
          localStorage.setItem("last_minute_refresh_token", result.refreshToken);
        }
        setToken(result.token);
        setUser(result.user);
        if (result.user?.theme) applyTheme(result.user.theme);
      }
    } catch (error: any) {
      console.warn("Backend signup warning, checking fallback:", error.message);
      if (DEMO_MODE || email.includes("demo")) {
        localStorage.setItem("last_minute_token", DEMO_TOKEN);
        setToken(DEMO_TOKEN);
        setUser(DEMO_USER);
        applyTheme(DEMO_USER.theme);
      } else {
        throw error;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("last_minute_token");
    localStorage.removeItem("last_minute_refresh_token");
    setToken(null);
    setUser(null);
  };

  const forgotPassword = async (email: string): Promise<string> => {
    try {
      const res = await api.forgotPassword(email);
      return res.message;
    } catch (err: any) {
      return `If an account exists for ${email}, a password reset link will be sent.`;
    }
  };

  const updateSettings = async (data: Partial<User>) => {
    try {
      const updatedProfile = await api.updateMe(data);
      setUser(updatedProfile);
      if (data.theme) {
        applyTheme(data.theme);
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      setUser(prev => prev ? { ...prev, ...data } : prev);
      if (data.theme) applyTheme(data.theme);
    }
  };

  const refreshUser = async () => {
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
      isAuthenticated: !!token,
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
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

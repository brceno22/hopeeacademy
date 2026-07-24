import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'moodleUserId';
const FULL_NAME_KEY = 'fullName';
const AVATAR_KEY = 'avatarUrl';
const AVATAR_COLOR_KEY = 'avatarColor';
const ADMIN_KEY = 'adminKey';

export const DEFAULT_AVATAR_COLOR = '#0071BC';

export interface AuthUser {
  token: string;
  userId: string | null;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  adminKey: string | null;
  isAdmin: boolean;
  loginStudent: (payload: {
    token: string;
    userId?: number | string | null;
    fullName?: string;
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) => void;
  updateStudentProfile: (patch: {
    fullName?: string;
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) => void;
  logoutStudent: () => void;
  loginAdmin: (key: string) => void;
  logoutAdmin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStudent(): AuthUser | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return {
    token,
    userId: localStorage.getItem(USER_ID_KEY),
    fullName: localStorage.getItem(FULL_NAME_KEY) || 'Student',
    avatarUrl: localStorage.getItem(AVATAR_KEY),
    avatarColor: localStorage.getItem(AVATAR_COLOR_KEY) || DEFAULT_AVATAR_COLOR,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => readStudent());
  const [adminKey, setAdminKey] = useState<string | null>(
    () => localStorage.getItem(ADMIN_KEY),
  );

  const loginStudent = useCallback(
    (payload: {
      token: string;
      userId?: number | string | null;
      fullName?: string;
      avatarUrl?: string | null;
      avatarColor?: string | null;
    }) => {
      localStorage.setItem(TOKEN_KEY, payload.token);
      if (payload.userId != null) {
        localStorage.setItem(USER_ID_KEY, String(payload.userId));
      }
      if (payload.fullName) {
        localStorage.setItem(FULL_NAME_KEY, payload.fullName);
      }
      if (payload.avatarUrl) {
        localStorage.setItem(AVATAR_KEY, payload.avatarUrl);
      } else {
        localStorage.removeItem(AVATAR_KEY);
      }
      const color = payload.avatarColor || DEFAULT_AVATAR_COLOR;
      localStorage.setItem(AVATAR_COLOR_KEY, color);
      localStorage.removeItem(ADMIN_KEY);
      setAdminKey(null);
      setUser({
        token: payload.token,
        userId: payload.userId != null ? String(payload.userId) : null,
        fullName: payload.fullName || 'Student',
        avatarUrl: payload.avatarUrl || null,
        avatarColor: color,
      });
    },
    [],
  );

  const updateStudentProfile = useCallback(
    (patch: {
      fullName?: string;
      avatarUrl?: string | null;
      avatarColor?: string | null;
    }) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (patch.fullName != null) {
          next.fullName = patch.fullName;
          localStorage.setItem(FULL_NAME_KEY, patch.fullName);
        }
        if (patch.avatarUrl !== undefined) {
          next.avatarUrl = patch.avatarUrl;
          if (patch.avatarUrl) localStorage.setItem(AVATAR_KEY, patch.avatarUrl);
          else localStorage.removeItem(AVATAR_KEY);
        }
        if (patch.avatarColor != null) {
          next.avatarColor = patch.avatarColor;
          localStorage.setItem(AVATAR_COLOR_KEY, patch.avatarColor);
        }
        return next;
      });
    },
    [],
  );

  const logoutStudent = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(FULL_NAME_KEY);
    localStorage.removeItem(AVATAR_KEY);
    localStorage.removeItem(AVATAR_COLOR_KEY);
    setUser(null);
  }, []);

  const loginAdmin = useCallback((key: string) => {
    localStorage.setItem(ADMIN_KEY, key);
    setAdminKey(key);
  }, []);

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(ADMIN_KEY);
    setAdminKey(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user?.token),
      adminKey,
      isAdmin: Boolean(adminKey),
      loginStudent,
      updateStudentProfile,
      logoutStudent,
      loginAdmin,
      logoutAdmin,
    }),
    [
      user,
      adminKey,
      loginStudent,
      updateStudentProfile,
      logoutStudent,
      loginAdmin,
      logoutAdmin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

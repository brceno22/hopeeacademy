import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api, { clearStudentStorage } from '@/core/api/axios';
import {
  DEFAULT_AVATAR_COLOR,
  authContext,
  type AdminStatus,
  type AuthContextValue,
  type AuthUser,
} from './auth';

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'moodleUserId';
const FULL_NAME_KEY = 'fullName';
const AVATAR_KEY = 'avatarUrl';
const AVATAR_COLOR_KEY = 'avatarColor';

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
  const [adminStatus, setAdminStatus] = useState<AdminStatus>('unknown');

  // La sesión de admin vive en una cookie HttpOnly, así que el estado sólo
  // puede venir del backend.
  useEffect(() => {
    let cancelled = false;

    api
      .get('/auth/admin/session')
      .then(() => {
        if (!cancelled) setAdminStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setAdminStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    clearStudentStorage();
    setUser(null);
  }, []);

  const loginAdmin = useCallback(async (key: string) => {
    await api.post('/auth/admin/session', { key });
    setAdminStatus('authenticated');
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await api.delete('/auth/admin/session');
    } catch {
      // Si el backend no responde no hay nada que reintentar: la cookie expira
      // sola y localmente ya dejamos de ser admin. No rechazar permite llamar
      // a logoutAdmin sin await desde un onClick.
    } finally {
      setAdminStatus('anonymous');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user?.token),
      adminStatus,
      isAdmin: adminStatus === 'authenticated',
      loginStudent,
      updateStudentProfile,
      logoutStudent,
      loginAdmin,
      logoutAdmin,
    }),
    [
      user,
      adminStatus,
      loginStudent,
      updateStudentProfile,
      logoutStudent,
      loginAdmin,
      logoutAdmin,
    ],
  );

  return <authContext.Provider value={value}>{children}</authContext.Provider>;
};

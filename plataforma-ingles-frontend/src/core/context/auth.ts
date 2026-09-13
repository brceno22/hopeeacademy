import { createContext, useContext } from 'react';

export const DEFAULT_AVATAR_COLOR = '#0071BC';

export interface AuthUser {
  token: string;
  userId: string | null;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string;
}

/** 'unknown' hasta que el backend confirme la cookie de sesión. */
export type AdminStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  adminStatus: AdminStatus;
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
  loginAdmin: (key: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
}

export const authContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(authContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

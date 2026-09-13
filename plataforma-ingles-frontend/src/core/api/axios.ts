/**
 * Axios client for the Nest API.
 *
 * In dev, VITE_API_URL points at the Vite proxy (`/api`) so the admin session
 * cookie stays same-origin. See vite.config.ts.
 *
 * If you point it at an absolute origin instead, the backend must allow it via
 * CORS_ORIGINS, e.g.:
 *   CORS_ORIGINS=http://localhost:5173
 * (comma-separated for multiple origins; empty denies all browser origins)
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

const ADMIN_CSRF_COOKIE = 'hopee_admin_csrf';
const ADMIN_CSRF_HEADER = 'x-admin-csrf';
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  // Necesario para enviar la cookie de sesión de admin.
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Double-submit: el backend compara este header con la cookie CSRF.
  if (config.headers && MUTATING_METHODS.has((config.method || 'get').toLowerCase())) {
    const csrf = readCookie(ADMIN_CSRF_COOKIE);
    if (csrf) {
      config.headers[ADMIN_CSRF_HEADER] = csrf;
    }
  }

  return config;
});

const STUDENT_STORAGE_KEYS = [
  'token',
  'moodleUserId',
  'fullName',
  'avatarUrl',
  'avatarColor',
];

export function clearStudentStorage() {
  for (const key of STUDENT_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

let handlingUnauthorized = false;

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/admin/session');

    if (status === 401 && !isAuthEndpoint && !handlingUnauthorized) {
      if (localStorage.getItem('token')) {
        handlingUnauthorized = true;
        clearStudentStorage();
        window.location.assign('/');
      }
    }

    return Promise.reject(error);
  },
);

export default api;

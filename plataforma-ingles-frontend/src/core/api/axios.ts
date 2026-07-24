import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3003';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let handlingUnauthorized = false;

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login');

    if (status === 401 && !isAuthEndpoint && !handlingUnauthorized) {
      if (localStorage.getItem('token')) {
        handlingUnauthorized = true;
        localStorage.removeItem('token');
        localStorage.removeItem('moodleUserId');
        localStorage.removeItem('fullName');
        window.location.assign('/');
      }
    }

    return Promise.reject(error);
  },
);

export default api;

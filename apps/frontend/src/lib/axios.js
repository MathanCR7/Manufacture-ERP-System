import axios from 'axios';
import useAuthStore from '../app/store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

const isSupervisorAllowedMutation = (config) => {
  const method = config.method?.toUpperCase();
  if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const url = config.url || '';
  const cleanUrl = url.split('?')[0];

  const allowedPatterns = [
    /^\/?auth\/logout$/,
    /^\/?attendance\/check-in$/,
    /^\/?attendance\/check-out$/,
    /^\/?users\/profile$/,
    /^\/?users\/request-password-change$/,
    /^\/?notifications\/seen-all$/,
    /^\/?notifications\/[^/]+\/seen$/
  ];

  return allowedPatterns.some(pattern => pattern.test(cleanUrl));
};

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return true;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const { exp } = JSON.parse(jsonPayload);
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch {
    return false;
  }
};

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      if (isTokenExpired(token)) {
        useAuthStore.getState().clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(new Error('Token expired'));
      }
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    const user = useAuthStore.getState().user;
    if (user?.role === 'SUPERVISOR' && !isSupervisorAllowedMutation(config)) {
      const err = new Error('View-only Mode: Supervisors are not allowed to make edits.');
      err.response = {
        status: 403,
        data: { error: 'View-only Mode: Supervisors are not allowed to make edits.' }
      };
      return Promise.reject(err);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.error || error.response?.data?.message || '';

    const isUnauthorizedOrExpired =
      status === 401 ||
      (status === 403 && typeof errorMessage === 'string' && (
        errorMessage.toLowerCase().includes('expired token') ||
        errorMessage.toLowerCase().includes('invalid token') ||
        errorMessage.toLowerCase().includes('no token provided')
      ));

    if (isUnauthorizedOrExpired) {
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

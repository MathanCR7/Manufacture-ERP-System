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

api.interceptors.request.use(
  (config) => {
    const user = useAuthStore.getState().user;
    if (user?.role === 'SUPERVISOR' && !isSupervisorAllowedMutation(config)) {
      const err = new Error('View-only Mode: Supervisors are not allowed to make edits.');
      err.response = {
        status: 403,
        data: { error: 'View-only Mode: Supervisors are not allowed to make edits.' }
      };
      return Promise.reject(err);
    }

    const token = useAuthStore.getState().token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

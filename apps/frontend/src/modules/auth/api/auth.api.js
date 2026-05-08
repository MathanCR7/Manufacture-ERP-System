import { api } from '@/lib/axios';

export const loginFn = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const logoutFn = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

import { api } from '@/lib/axios';

export const getRolesFn = async () => {
  const response = await api.get('/roles');
  return response.data;
};

export const createRoleFn = async (data) => {
  const response = await api.post('/roles', data);
  return response.data;
};

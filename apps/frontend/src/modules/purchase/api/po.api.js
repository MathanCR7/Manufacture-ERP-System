import { api } from '@/lib/axios';

export const getPOsFn = async () => {
  const response = await api.get('/po');
  return response.data;
};

export const createPOFn = async (data) => {
  const response = await api.post('/po', data);
  return response.data;
};

export const getPOByIdFn = async (id) => {
  const response = await api.get(`/po/${id}`);
  return response.data;
};

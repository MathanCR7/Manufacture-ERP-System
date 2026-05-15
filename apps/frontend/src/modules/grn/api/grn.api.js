import { api } from '@/lib/axios';

export const getGRNsFn = async () => {
  const response = await api.get('/grn');
  return response.data;
};

export const createGRNFn = async (data) => {
  const response = await api.post('/grn', data);
  return response.data;
};

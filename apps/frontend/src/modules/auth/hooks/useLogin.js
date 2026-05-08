import { useState } from 'react';
import { loginFn } from '../api/auth.api';
import useAuthStore from '@/app/store/authStore';

export const useLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  const mutateAsync = async (credentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await loginFn(credentials);
      setAuth(data.token, data.user);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return { mutateAsync, isLoading, error };
};

import { useState, useEffect } from 'react';
import { getRolesFn, createRoleFn } from '../api/role.api';

export const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const data = await getRolesFn();
      setRoles(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const createRole = async (roleData) => {
    try {
      await createRoleFn(roleData);
      await fetchRoles(); // refresh list
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to create role');
    }
  };

  return { roles, isLoading, error, createRole };
};

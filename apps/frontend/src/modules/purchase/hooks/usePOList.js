import { useState, useEffect } from 'react';
import { getPOsFn } from '../api/po.api';

export const usePOList = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPOs = async () => {
    setIsLoading(true);
    try {
      const response = await getPOsFn();
      setData(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch POs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, []);

  return { data, isLoading, error, refetch: fetchPOs };
};

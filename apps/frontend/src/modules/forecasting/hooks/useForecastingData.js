import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/axios';

export function useForecastingData(defaultHorizon = '30') {
  const [horizonPreset, setHorizonPreset] = useState(defaultHorizon);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [forecastData, setForecastData] = useState(null);
  const [error, setError] = useState(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (horizonPreset === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      } else {
        params.horizonDays = horizonPreset;
      }
      const res = await api.get('/forecasting/comprehensive', { params });
      setForecastData(res.data);
    } catch (err) {
      console.error('Failed to load comprehensive forecast:', err);
      setError(err?.response?.data?.message || 'Failed to fetch forecast data');
    } finally {
      setLoading(false);
    }
  }, [horizonPreset, customStart, customEnd]);

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 60000); // 60s live data auto-refresh
    return () => clearInterval(interval);
  }, [fetchForecast]);

  return {
    horizonPreset,
    setHorizonPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    loading,
    forecastData,
    error,
    refetch: fetchForecast
  };
}

export default useForecastingData;

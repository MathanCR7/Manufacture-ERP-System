import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

// Common query config: pauses polling when window is hidden, refetches on focus
const createPollingConfig = (intervalMs, token) => ({
  refetchInterval: intervalMs,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  enabled: !!token,
  staleTime: Math.min(intervalMs / 2, 15000),
  retry: 1
});

// 1. Overview & Top 8 KPIs + Needs Attention
export function useDashboardOverview() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'overview'],
    queryFn: async () => {
      const res = await api.get('/dashboard/overview');
      return res.data;
    },
    ...createPollingConfig(30000, token) // 30s polling
  });
}

function buildPeriodQuery(periodOrDays, customRange) {
  let period = '';
  let startDate = '';
  let endDate = '';
  let days = null;

  if (typeof periodOrDays === 'object' && periodOrDays !== null) {
    period = periodOrDays.period || '';
    startDate = periodOrDays.startDate || '';
    endDate = periodOrDays.endDate || '';
    days = periodOrDays.days;
  } else if (typeof periodOrDays === 'number') {
    days = periodOrDays;
    period = `${periodOrDays}d`;
  } else if (typeof periodOrDays === 'string') {
    period = periodOrDays;
    startDate = customRange?.startDate || '';
    endDate = customRange?.endDate || '';
  }

  const q = new URLSearchParams();
  if (period) q.append('period', period);
  if (startDate) q.append('startDate', startDate);
  if (endDate) q.append('endDate', endDate);
  if (days) q.append('days', days);

  return { period, startDate, endDate, days, queryString: q.toString() };
}

// 2. Active Batches
export function useActiveBatches(periodOrOptions, customRange = {}) {
  const { token } = useAuthStore();
  const { period, startDate, endDate, days, queryString } = buildPeriodQuery(periodOrOptions, customRange);
  return useQuery({
    queryKey: ['factory-dashboard', 'active-batches', period, startDate, endDate, days],
    queryFn: async () => {
      const res = await api.get(`/dashboard/production/active-batches${queryString ? `?${queryString}` : ''}`);
      return res.data;
    },
    ...createPollingConfig(30000, token) // 30s polling
  });
}

// 3. PO Kanban Pipeline
export function usePoPipeline(periodOrOptions, customRange = {}) {
  const { token } = useAuthStore();
  const { period, startDate, endDate, days, queryString } = buildPeriodQuery(periodOrOptions, customRange);
  return useQuery({
    queryKey: ['factory-dashboard', 'po-pipeline', period, startDate, endDate, days],
    queryFn: async () => {
      const res = await api.get(`/dashboard/procurement/pipeline${queryString ? `?${queryString}` : ''}`);
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

// PO Approval Mutation
export function useApprovePo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (poId) => {
      const res = await api.patch(`/dashboard/procurement/approve-po/${poId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-dashboard', 'po-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['factory-dashboard', 'overview'] });
    }
  });
}

// 4. Inbound Recent GRNs
export function useRecentGrn(periodOrOptions, customRange = {}) {
  const { token } = useAuthStore();
  const { period, startDate, endDate, days, queryString } = buildPeriodQuery(periodOrOptions, customRange);
  return useQuery({
    queryKey: ['factory-dashboard', 'recent-grn', period, startDate, endDate, days],
    queryFn: async () => {
      const res = await api.get(`/dashboard/procurement/grn-recent${queryString ? `?${queryString}` : ''}`);
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

// 5. Inbound Inflow
export function useInflowData(periodOrDays = '7d', customRange = {}) {
  const { token } = useAuthStore();
  const { period, startDate, endDate, days, queryString } = buildPeriodQuery(periodOrDays, customRange);
  return useQuery({
    queryKey: ['factory-dashboard', 'inflow', period, startDate, endDate, days],
    queryFn: async () => {
      const res = await api.get(`/dashboard/procurement/inflow${queryString ? `?${queryString}` : ''}`);
      return res.data;
    },
    ...createPollingConfig(300000, token) // 5 min
  });
}

// 6. Raw Material Stock Health (ALL RM Available Quantity)
export function useRmHealth() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'rm-health'],
    queryFn: async () => {
      const res = await api.get('/dashboard/inventory/rm-health');
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

// 7. Finished Goods Stock (TOTAL End Product Available Stock)
export function useFinishedGoods() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'finished-goods'],
    queryFn: async () => {
      const res = await api.get('/dashboard/inventory/finished-goods');
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

// 8. FIFO Expiry Watchlist
export function useExpiryWatchlist() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'expiry-watchlist'],
    queryFn: async () => {
      const res = await api.get('/dashboard/inventory/expiry');
      return res.data;
    },
    ...createPollingConfig(120000, token)
  });
}

// 9. Sales Revenue Trend (Accepts period '7d' | 'this_month' | 'last_month' | 'this_year' | 'custom' or days)
export function useSalesRevenue(periodOrDays = '7d', customRange = {}) {
  const { token } = useAuthStore();

  let period = '7d';
  let startDate = '';
  let endDate = '';
  let days = null;

  if (typeof periodOrDays === 'object' && periodOrDays !== null) {
    period = periodOrDays.period || '7d';
    startDate = periodOrDays.startDate || '';
    endDate = periodOrDays.endDate || '';
    days = periodOrDays.days;
  } else if (typeof periodOrDays === 'number') {
    days = periodOrDays;
    period = `${periodOrDays}d`;
  } else if (typeof periodOrDays === 'string') {
    period = periodOrDays;
    startDate = customRange?.startDate || '';
    endDate = customRange?.endDate || '';
  }

  return useQuery({
    queryKey: ['factory-dashboard', 'sales-revenue', period, startDate, endDate, days],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (period) q.append('period', period);
      if (startDate) q.append('startDate', startDate);
      if (endDate) q.append('endDate', endDate);
      if (days) q.append('days', days);
      const res = await api.get(`/dashboard/sales/revenue?${q.toString()}`);
      return res.data;
    },
    ...createPollingConfig(300000, token)
  });
}

// 10. Sales Pipeline & Deliveries
export function useSalesPipeline() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'sales-pipeline'],
    queryFn: async () => {
      const res = await api.get('/dashboard/sales/pipeline');
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

// 11. Top SKUs (Filtered by period / statutory tax invoices)
export function useTopSkus(periodOrDays, customRange = {}) {
  const { token } = useAuthStore();

  let period = '';
  let startDate = '';
  let endDate = '';

  if (typeof periodOrDays === 'object' && periodOrDays !== null) {
    period = periodOrDays.period || '';
    startDate = periodOrDays.startDate || '';
    endDate = periodOrDays.endDate || '';
  } else if (typeof periodOrDays === 'string') {
    period = periodOrDays;
    startDate = customRange?.startDate || '';
    endDate = customRange?.endDate || '';
  }

  return useQuery({
    queryKey: ['factory-dashboard', 'top-skus', period, startDate, endDate],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (period) q.append('period', period);
      if (startDate) q.append('startDate', startDate);
      if (endDate) q.append('endDate', endDate);
      const qs = q.toString();
      const res = await api.get(`/dashboard/sales/top-skus${qs ? `?${qs}` : ''}`);
      return res.data;
    },
    ...createPollingConfig(120000, token)
  });
}

// 12. Top Distributors
export function useTopCustomers() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'top-customers'],
    queryFn: async () => {
      const res = await api.get('/dashboard/sales/top-customers');
      return res.data;
    },
    ...createPollingConfig(120000, token)
  });
}

// 13. Quality Summary
export function useQualitySummary() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'quality-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/quality/summary');
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

// 14. Cold Room Temperature
export function useColdRoomTemp() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'cold-room-temp'],
    queryFn: async () => {
      const res = await api.get('/dashboard/quality/cold-room?hours=24');
      return res.data;
    },
    ...createPollingConfig(60000, token) // 60s
  });
}

// 15. Finance Cost per Unit
export function useCostPerUnit() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'cost-per-unit'],
    queryFn: async () => {
      const res = await api.get('/dashboard/finance/cost-per-unit');
      return res.data;
    },
    ...createPollingConfig(120000, token)
  });
}

// 16. OEE Gauge
export function useOeeData() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'oee'],
    queryFn: async () => {
      const res = await api.get('/dashboard/finance/oee');
      return res.data;
    },
    ...createPollingConfig(120000, token)
  });
}

// 17. Scrap Trend
export function useScrapTrend(days = 14) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'scrap-trend', days],
    queryFn: async () => {
      const res = await api.get(`/dashboard/finance/scrap?days=${days}`);
      return res.data;
    },
    ...createPollingConfig(300000, token)
  });
}

// 18. Audit Activity Feed
export function useActivityFeed(limit = 20) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'activity', limit],
    queryFn: async () => {
      const res = await api.get(`/dashboard/activity?limit=${limit}`);
      return res.data;
    },
    ...createPollingConfig(30000, token) // 30s
  });
}

// 19. Shift Notes
export function useShiftNotes() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ['factory-dashboard', 'shift-notes'],
    queryFn: async () => {
      const res = await api.get('/dashboard/shift-notes');
      return res.data;
    },
    ...createPollingConfig(60000, token)
  });
}

export function useCreateShiftNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteText) => {
      const res = await api.post('/dashboard/shift-notes', { noteText });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factory-dashboard', 'shift-notes'] });
    }
  });
}


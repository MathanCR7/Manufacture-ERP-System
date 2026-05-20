import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Factory, AlertTriangle, Truck, ClipboardList, CheckSquare, 
  RotateCw, ChevronRight, Activity, TrendingUp, Calendar, 
  TrendingDown, CheckCircle2, AlertCircle, XCircle, Clock
} from 'lucide-react';
import useAuthStore from '@/app/store/authStore';

// Helper to format currency
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatTime = (timestamp) => {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', { hour12: false });
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  
  // Roles mapping: MAIN_MASTER/ADMIN -> ADMIN, others -> MATERIAL_SUPERVISOR
  const userRole = (user?.role === 'MAIN_MASTER' || user?.role === 'ADMIN') ? 'ADMIN' : 'MATERIAL_SUPERVISOR';
  const isAdmin = userRole === 'ADMIN';

  const [productionTab, setProductionTab] = useState('active');

  // ----------------------------------------------------
  // QUERIES SETUP WITH AUTO-POLLING / MANUAL REFRESH
  // ----------------------------------------------------

  // 1. KPI Summary (auto-refresh every 60s)
  const kpiQuery = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const res = await api.get('/dashboard/kpis');
      return res.data;
    },
    refetchInterval: 60000,
    enabled: !!token
  });

  // 2. Purchase Orders
  const poQuery = useQuery({
    queryKey: ['dashboard-purchase-orders'],
    queryFn: async () => {
      const res = await api.get('/purchase-orders?limit=12&sort=createdAt_desc');
      return res.data;
    },
    enabled: !!token
  });

  // 3. Productions (refetches when tab changes)
  const productionsQuery = useQuery({
    queryKey: ['dashboard-productions', productionTab],
    queryFn: async () => {
      const res = await api.get(`/productions?status=${productionTab}&limit=10`);
      return res.data;
    },
    enabled: !!token
  });

  // 4. Lab Tests Summary (auto-refresh every 30s)
  const labSummaryQuery = useQuery({
    queryKey: ['dashboard-lab-summary'],
    queryFn: async () => {
      const res = await api.get('/lab-tests/summary?date=today');
      return res.data;
    },
    refetchInterval: 30000,
    enabled: !!token && isAdmin
  });

  // 5. Recent Lab Tests
  const labTestsQuery = useQuery({
    queryKey: ['dashboard-lab-tests'],
    queryFn: async () => {
      const res = await api.get('/lab-tests?limit=6&sort=testedAt_desc');
      return res.data;
    },
    enabled: !!token && isAdmin
  });

  // 6. Material Receive Log (GRN)
  const grnQuery = useQuery({
    queryKey: ['dashboard-grn'],
    queryFn: async () => {
      const res = await api.get('/grn?limit=8&sort=receivedAt_desc');
      return res.data;
    },
    enabled: !!token
  });

  // 7. Customer Orders
  const ordersQuery = useQuery({
    queryKey: ['dashboard-orders'],
    queryFn: async () => {
      const res = await api.get('/orders?limit=8&sort=createdAt_desc');
      return res.data;
    },
    enabled: !!token && isAdmin
  });

  // 8. Production Loss
  const lossQuery = useQuery({
    queryKey: ['dashboard-production-loss'],
    queryFn: async () => {
      const res = await api.get('/production-loss/summary?range=30d');
      return res.data;
    },
    enabled: !!token
  });

  // 9. Forecast by Product
  const forecastProductQuery = useQuery({
    queryKey: ['dashboard-forecast-product'],
    queryFn: async () => {
      const res = await api.get('/forecast/by-product?days=30&limit=5');
      return res.data;
    },
    enabled: !!token && isAdmin
  });

  // 10. Forecast by Order
  const forecastOrderQuery = useQuery({
    queryKey: ['dashboard-forecast-order'],
    queryFn: async () => {
      const res = await api.get('/forecast/by-order?days=30');
      return res.data;
    },
    enabled: !!token && isAdmin
  });

  // 11. System Alerts Feed (auto-refresh every 30s)
  const alertsQuery = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const res = await api.get('/notifications?unread=true&limit=20');
      return res.data;
    },
    refetchInterval: 30000,
    enabled: !!token
  });

  // Manual Refresh Handler
  const handleManualRefresh = () => {
    poQuery.refetch();
    productionsQuery.refetch();
    grnQuery.refetch();
    lossQuery.refetch();
    if (isAdmin) {
      labTestsQuery.refetch();
      ordersQuery.refetch();
      forecastProductQuery.refetch();
      forecastOrderQuery.refetch();
    }
  };

  // Critical queries check (we exclude productionsQuery loading so tab clicks do not trigger full screen spinner)
  const isCriticalLoading = kpiQuery.isLoading || poQuery.isLoading || grnQuery.isLoading || lossQuery.isLoading;

  if (isCriticalLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-[#F4F3FF] dark:bg-slate-950 rounded-2xl">
        <div className="text-center space-y-4">
          <RotateCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Synchronizing ERP modules...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER SECTIONS HELPER
  // ----------------------------------------------------

  // Delta badge utility
  const renderDelta = (text, type = 'success') => {
    const baseClass = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold";
    const colors = type === 'success' 
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
    return <span className={`${baseClass} ${colors}`}>{text}</span>;
  };

  // Section Header Component
  const SectionHeader = ({ title, queryRef, showRefresh = true }) => {
    const isFetching = queryRef?.isFetching;
    const updatedAt = queryRef?.dataUpdatedAt;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-slate-800 pb-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Last updated: {formatTime(updatedAt)}
          </p>
        </div>
        {showRefresh && (
          <button 
            type="button"
            onClick={() => queryRef?.refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">
      

      {/* ----------------------------------------------------
          SECTION 1: KPI SUMMARY ROW (Polling 60s)
         ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Productions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 rounded-xl">
              <Factory className="w-5 h-5" />
            </div>
            {renderDelta("+2 new")}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Active Productions</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {kpiQuery.data?.activeProductions || 0}
            </h3>
          </div>
        </div>

        {/* POs Pending Approval */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <ClipboardList className="w-5 h-5" />
            </div>
            {renderDelta("-12%")}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">POs Pending Approval</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {kpiQuery.data?.posPendingApproval || 0}
            </h3>
          </div>
        </div>

        {/* Raw Materials Low Stock */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            {kpiQuery.data?.lowStockMaterials > 0 ? renderDelta("Critical", 'danger') : renderDelta("All Good")}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Low Stock Materials</p>
            <h3 className={`text-2xl font-black mt-1 ${kpiQuery.data?.lowStockMaterials > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {kpiQuery.data?.lowStockMaterials || 0}
            </h3>
          </div>
        </div>

        {/* QC Batches Pending */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <CheckSquare className="w-5 h-5" />
            </div>
            {kpiQuery.data?.qcBatchesPending > 0 ? renderDelta("Action Required", 'danger') : renderDelta("Queue Clear")}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">QC Queue Pending</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {kpiQuery.data?.qcBatchesPending || 0}
            </h3>
          </div>
        </div>

        {/* Orders to Dispatch */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
            {renderDelta("+8%")}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Orders to Dispatch</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {kpiQuery.data?.ordersToDispatch || 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left 2/3 Column */}
        <div className="xl:col-span-2 space-y-6">

          {/* ----------------------------------------------------
              SECTION 2: PURCHASE ORDER PIPELINE
             ---------------------------------------------------- */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
            <SectionHeader title="Purchase Order Pipeline" queryRef={poQuery} />

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              {['DRAFT', 'PENDING APPROVAL', 'APPROVED', 'RECEIVED'].map((colName) => {
                // Filter POs belonging to this stage
                const rawPos = poQuery.data || [];
                const stagePos = rawPos.filter(po => {
                  if (colName === 'PENDING APPROVAL') return po.status === 'PENDING';
                  if (colName === 'APPROVED') return po.status === 'APPROVED' || po.status === 'ORDERED';
                  if (colName === 'RECEIVED') return po.status === 'RECEIVED';
                  if (colName === 'DRAFT') return !['PENDING', 'APPROVED', 'ORDERED', 'RECEIVED'].includes(po.status);
                  return false;
                });

                const maxCards = 3;
                const visiblePos = stagePos.slice(0, maxCards);
                const remainingCount = stagePos.length - maxCards;

                return (
                  <div key={colName} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl flex flex-col min-h-[220px]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
                        {colName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                        {stagePos.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1">
                      {visiblePos.map((po) => (
                        <div 
                          key={po.id} 
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-900/60 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{po.referenceNo}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-semibold truncate">{po.supplierName}</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/40">
                            {isAdmin ? (
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatCurrency(po.amount)}</span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-slate-400">Restricted</span>
                            )}
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(po.createdAt)}</span>
                          </div>
                        </div>
                      ))}

                      {stagePos.length === 0 && (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200/60 dark:border-slate-800/60 rounded-lg p-4 text-center">
                          <span className="text-xs text-slate-400 dark:text-slate-600">No Orders</span>
                        </div>
                      )}
                    </div>

                    {remainingCount > 0 && (
                      <button 
                        type="button"
                        onClick={() => navigate('/purchase-orders')}
                        className="w-full mt-2 text-center py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/50 transition-colors"
                      >
                        + {remainingCount} More POs
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ----------------------------------------------------
              SECTION 3: PRODUCTION STATUS TABLE (Local loading)
             ---------------------------------------------------- */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Active Production Status</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Last updated: {formatTime(productionsQuery.dataUpdatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                {['active', 'Planned', 'In Progress', 'Completed', 'On Hold'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProductionTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      productionTab === tab 
                        ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab === 'active' ? 'Active' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Table with inline/local loading spinner to prevent full page reloads */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="p-4">Batch No</th>
                    <th className="p-4">Product Name</th>
                    <th className="p-4">Planned Qty</th>
                    <th className="p-4">Produced Qty</th>
                    <th className="p-4">% Done</th>
                    <th className="p-4">Start Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {productionsQuery.isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex justify-center items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>Loading production batches...</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {productionsQuery.data?.map((p) => {
                        const donePercent = p.quantity > 0 ? Math.min(100, Math.round((p.partiallyDoneQty / p.quantity) * 100)) : 0;
                        
                        // Done Percent color
                        let barColor = 'bg-rose-500';
                        if (donePercent >= 80) barColor = 'bg-emerald-500';
                        else if (donePercent >= 40) barColor = 'bg-amber-500';

                        // Status pill color
                        let statusColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                        if (p.status === 'Completed') statusColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
                        else if (p.status === 'In Progress') statusColor = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400';
                        else if (p.status === 'Planned') statusColor = 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400';
                        else if (p.status === 'On Hold') statusColor = 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';

                        return (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 even:bg-[#FAF9FF] dark:even:bg-slate-900/10 transition-colors text-sm text-slate-700 dark:text-slate-300">
                            <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.referenceNo}</td>
                            <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{p.productName}</td>
                            <td className="p-4">{p.quantity}</td>
                            <td className="p-4">{p.partiallyDoneQty}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                  <div className={`${barColor} h-full`} style={{ width: `${donePercent}%` }}></div>
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{donePercent}%</span>
                              </div>
                            </td>
                            <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(p.startDate)}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                type="button"
                                onClick={() => navigate('/production/batches')}
                                className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:scale-105 active:scale-95 transition-all"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {productionsQuery.data?.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-600 text-sm">
                            No active production processes.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ----------------------------------------------------
              SECTION 5: MATERIAL RECEIVE LOG
             ---------------------------------------------------- */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
            <SectionHeader title="Material Receive activity (GRN)" queryRef={grnQuery} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              
              {/* Table - 3 cols */}
              <div className="lg:col-span-3 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="p-4">GRN No</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Qty</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {grnQuery.data?.grns?.map((g) => {
                      let statusColor = "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
                      if (g.status === 'ACCEPTED') statusColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
                      if (g.status === 'REJECTED') statusColor = "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";

                      return (
                        <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 even:bg-[#FAF9FF] dark:even:bg-slate-900/10 transition-colors text-sm text-slate-700 dark:text-slate-300">
                          <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{g.grnNo}</td>
                          <td className="p-4">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{g.supplier}</p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{g.materialName}</span>
                          </td>
                          <td className="p-4 text-xs font-semibold">
                            {g.qtyReceived} <span className="text-slate-400">{g.unit}</span>
                          </td>
                          <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(g.receivedDate)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {grnQuery.data?.grns?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-600 text-sm">
                          No recent material deliveries logged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bar Chart - 2 cols */}
              <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Materials Received — Last 7 Days</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sum of raw material weight in kgs</p>
                </div>

                <div className="h-[180px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grnQuery.data?.last7Days || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                      <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="qty_kg" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right 1/3 Sidebar Column */}
        <div className="space-y-6">

          {/* ----------------------------------------------------
              SECTION 9: SYSTEM ALERTS FEED
             ---------------------------------------------------- */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800 flex flex-col max-h-[500px]">
            <SectionHeader title="System Alerts & Logs" queryRef={alertsQuery} />

            <div className="overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {alertsQuery.data?.map((alert) => {
                let alertIcon = <AlertCircle className="w-4 h-4 text-amber-600" />;
                let alertBg = "bg-amber-50 dark:bg-amber-950/20";
                
                if (alert.category === 'QC_FAIL') {
                  alertIcon = <XCircle className="w-4 h-4 text-rose-600" />;
                  alertBg = "bg-rose-50 dark:bg-rose-950/20";
                } else if (alert.category === 'PRODUCTION_COMPLETE') {
                  alertIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                  alertBg = "bg-emerald-50 dark:bg-emerald-500/10";
                } else if (alert.category === 'PO_PENDING') {
                  alertIcon = <Clock className="w-4 h-4 text-indigo-600" />;
                  alertBg = "bg-indigo-50 dark:bg-indigo-950/20";
                }

                return (
                  <div key={alert.id} className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className={`p-2 rounded-xl shrink-0 ${alertBg}`}>
                      {alertIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold break-words">
                        {alert.title}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                        {formatDate(alert.timestamp)} • {formatTime(alert.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {alertsQuery.data?.length === 0 && (
                <div className="py-8 text-center text-slate-400 dark:text-slate-600 text-xs">
                  All alerts clear. No critical alerts reported.
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------
              SECTION 4: LAB TEST / QC STATUS (Admin Only)
             ---------------------------------------------------- */}
          {isAdmin && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
              <SectionHeader title="Lab QC Tests (Today)" queryRef={labSummaryQuery} />

              {/* Summary Pie */}
              <div className="flex justify-between items-center gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                <div className="w-[120px] h-[120px] relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Passed', value: labSummaryQuery.data?.passed || 0, color: '#10B981' },
                          { name: 'Failed', value: labSummaryQuery.data?.failed || 0, color: '#EF4444' },
                          { name: 'Pending', value: labSummaryQuery.data?.pending || 0, color: '#F59E0B' }
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={48}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {[
                          { name: 'Passed', value: labSummaryQuery.data?.passed || 0, color: '#10B981' },
                          { name: 'Failed', value: labSummaryQuery.data?.failed || 0, color: '#EF4444' },
                          { name: 'Pending', value: labSummaryQuery.data?.pending || 0, color: '#F59E0B' }
                        ].filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center Total */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                      {labSummaryQuery.data?.total || 0}
                    </span>
                    <span className="text-[8px] text-slate-400 uppercase tracking-widest">Tests</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Passed
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{labSummaryQuery.data?.passed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      Failed
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{labSummaryQuery.data?.failed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      Pending
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{labSummaryQuery.data?.pending || 0}</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                      <th className="p-3">Batch/GRN</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
                    {labTestsQuery.data?.map((test) => {
                      let resColor = "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
                      if (test.result === 'PASS') resColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
                      if (test.result === 'FAIL') resColor = "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";

                      return (
                        <tr key={test.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{test.batchNo}</td>
                          <td className="p-3 font-semibold truncate max-w-[100px]">{test.productName}</td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${resColor}`}>
                              {test.result}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              SECTION 7: PRODUCTION LOSS SUMMARY
             ---------------------------------------------------- */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
            <SectionHeader title="Production Loss Trends" queryRef={lossQuery} />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Weight Loss</span>
                <h4 className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
                  {lossQuery.data?.totalLossKg?.toFixed(1) || 0} kg
                </h4>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Loss Value</span>
                <h4 className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
                  {isAdmin ? formatCurrency(lossQuery.data?.lossValueINR || 0) : 'Restricted'}
                </h4>
              </div>
            </div>

            <div className="h-[140px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lossQuery.data?.dailyLoss || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 8 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 8 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                  <Line type="monotone" dataKey="loss_qty_kg" stroke="#EF4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

      {/* ----------------------------------------------------
          SECTION 6: ORDER FULFILMENT STATUS (Admin Only)
         ---------------------------------------------------- */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100 dark:border-slate-800 pb-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Customer Order Fulfilment</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Last updated: {formatTime(ordersQuery.dataUpdatedAt)}
              </p>
            </div>
            
            {/* Status Pills */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-bold">
                  {(ordersQuery.data || []).filter(o => o.status === 'Quotation').length}
                </span>
                <span className="text-slate-500">Quotations</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-bold">
                  {(ordersQuery.data || []).filter(o => ['Confirmed', 'Waiting for Production', 'In Production'].includes(o.status)).length}
                </span>
                <span className="text-slate-500">In Progress</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 font-bold">
                  {(ordersQuery.data || []).filter(o => o.status === 'Ready for Shipment').length}
                </span>
                <span className="text-slate-500">Ready to Ship</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Total Qty</th>
                  <th className="p-4">Order Date</th>
                  <th className="p-4">Expected Delivery</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {ordersQuery.data?.map((o) => {
                  let statusColor = "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                  if (o.status === 'Quotation') statusColor = "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
                  else if (o.status === 'Confirmed') statusColor = "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";
                  else if (o.status === 'In Production') statusColor = "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
                  else if (o.status === 'Ready for Shipment') statusColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
                  else if (o.status === 'Delivered') statusColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                  return (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 even:bg-[#FAF9FF] dark:even:bg-slate-900/10 transition-colors text-sm text-slate-700 dark:text-slate-300">
                      <td className="p-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{o.referenceNo}</td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{o.customerName}</td>
                      <td className="p-4 truncate max-w-[200px]">{o.productName}</td>
                      <td className="p-4 font-semibold">{o.qty} pcs</td>
                      <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(o.orderDate)}</td>
                      <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{formatDate(o.expected)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          type="button"
                          onClick={() => navigate('/orders/list')}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:scale-105 active:scale-95 transition-all"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {ordersQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-600 text-sm">
                      No customer orders recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          SECTION 8: FORECASTING SNAPSHOT (Admin Only)
         ---------------------------------------------------- */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Top 5 Products horizontal bar */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
            <SectionHeader title="Top 5 Products by Forecasted Demand" queryRef={forecastProductQuery} />
            
            <div className="h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastProductQuery.data || []} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} width={120} />
                  <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="demand" fill="#818CF8" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming orders Area Chart */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-indigo-50/50 dark:border-slate-800">
            <SectionHeader title="Upcoming Orders Demand Forecast" queryRef={forecastOrderQuery} />

            <div className="h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastOrderQuery.data || []}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="forecasted_units" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorUnits)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

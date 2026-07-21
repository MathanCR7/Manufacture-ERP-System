import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  FlaskConical, ClipboardList, AlertTriangle, ArrowRight,
  Plus, RefreshCw, Activity,
  CheckCircle2, Clock, Archive, Package, ShieldCheck,
  Layers, Eye, ArrowUpRight, ArrowDownRight, Users
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_COLORS = {
  REAGENT:    'bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-500/20',
  CHEMICAL:   'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  CONSUMABLE: 'bg-teal-500/10 text-teal-650 dark:text-teal-400 border border-teal-550/20',
  EQUIPMENT:  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
  GLASSWARE:  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
  SAFETY:     'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
};

const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B']; // Green (Approved), Red (Rejected), Orange (Need Sample)

function KPICard({ title, value, sub, icon: Icon, gradient, trend, loading, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-105 dark:border-slate-800 p-5 relative overflow-hidden transition-all duration-300 hover:shadow-md group ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-905/60 hover:bg-slate-50/20 dark:hover:bg-slate-950/20' : 'hover:-translate-y-0.5'
      }`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</span>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-slate-500 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-805 dark:text-slate-100 tracking-tight mb-1">
        {loading ? <span className="inline-block h-7 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" /> : value}
      </div>
      {sub && (
        <div className="text-xs">
          {trend === 'up' && (
            <span className="inline-flex items-center gap-0.5 text-emerald-650 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">
              <ArrowUpRight size={12} />
              {sub}
            </span>
          )}
          {trend === 'down' && (
            <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-455 font-semibold bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-full">
              <ArrowDownRight size={12} />
              {sub}
            </span>
          )}
          {trend === 'neutral' && (
            <span className="text-slate-400 dark:text-slate-500 font-medium">
              {sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function LabDashboardPage() {
  const navigate = useNavigate();
  const [pendingTab, setPendingTab] = useState('rm'); // 'rm' or 'production'
  const [recentTab, setRecentTab] = useState('rm'); // 'rm' or 'production' or 'usage'
  
  // Real-time live data query with 15s auto-polling
  const { data: dashData, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['lab-dashboard-data'],
    queryFn: async () => {
      const res = await api.get('/dashboard/lab');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const handlePendingClick = (item) => {
    if (pendingTab === 'rm') {
      navigate(`/lab/test/${item.grnId}`);
    } else {
      navigate('/production/qc-queue', { state: { highlightBatchId: item.id, search: item.batchNumber } });
    }
  };

  const handleRecentTestClick = (test, type) => {
    if (type === 'rm') {
      navigate(`/lab/test/${test.grnId}`);
    } else {
      navigate('/production/qc-queue');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 mx-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[350px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[350px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const {
    inventoryStats = { totalItems: 0, lowStockCount: 0, criticalCount: 0, expiredCount: 0, categoryBreakdown: [] },
    pendingTests = { rm: [], production: [] },
    testStats = { rm: { approved: 0, rejected: 0, resample: 0, total: 0 }, production: { passed: 0, failed: 0, total: 0 } },
    recentRmResults = [],
    recentProdResults = [],
    recentUsages = [],
    lowStockLabItems = [],
    monthlyTestingVolume = []
  } = dashData || {};

  // Compute overall stats
  const totalPendingCount = pendingTests.rm.length + pendingTests.production.length;
  const totalLabApproved = testStats.rm.approved + testStats.production.passed;
  const totalLabRejected = testStats.rm.rejected + testStats.production.failed;
  const totalTestsCount = totalLabApproved + totalLabRejected + testStats.rm.resample;
  const qcPassRate = totalTestsCount > 0 ? ((totalLabApproved / totalTestsCount) * 100).toFixed(1) : '100';

  // Pie chart formatting for decisions
  const pieData = [
    { name: 'Approved / Passed', value: totalLabApproved },
    { name: 'Rejected / Failed', value: totalLabRejected },
    { name: 'Re-sample Needed', value: testStats.rm.resample }
  ].filter(d => d.value > 0);

  // Default pie if no data exists
  const displayPieData = pieData.length > 0 ? pieData : [
    { name: 'No Tests Conducted', value: 1 }
  ];

  return (
    <div className="space-y-6 bg-[#f8fafc] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">
      
      {/* Expanded standard 6 columns KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard 
          title="Pending Inspections"
          value={totalPendingCount}
          sub={`${pendingTests.rm.length} RM • ${pendingTests.production.length} Batch`}
          icon={Clock}
          gradient="from-violet-500 to-violet-600"
          trend="neutral"
          loading={false}
          onClick={() => {}}
        />
        <KPICard 
          title="QC Pass Rate (30d)"
          value={`${qcPassRate}%`}
          sub={`${totalLabApproved} Pass • ${totalLabRejected} Fail`}
          icon={ShieldCheck}
          gradient="from-emerald-500 to-emerald-600"
          trend="up"
          loading={false}
          onClick={() => navigate('/lab/results')}
        />
        <KPICard 
          title="Total Tests (30d)"
          value={totalTestsCount}
          sub="RM & finished batches"
          icon={Activity}
          gradient="from-indigo-500 to-indigo-600"
          trend="neutral"
          loading={false}
          onClick={() => navigate('/lab/results')}
        />
        <KPICard 
          title="Lab Items Stocked"
          value={inventoryStats.totalItems}
          sub="Reagents & safety equipment"
          icon={Package}
          gradient="from-blue-500 to-blue-600"
          trend="neutral"
          loading={false}
          onClick={() => navigate('/lab-inventory/list')}
        />
        <KPICard 
          title="Low Stock Alerts"
          value={inventoryStats.lowStockCount}
          sub="Below safety level"
          icon={AlertTriangle}
          gradient="from-amber-500 to-amber-600"
          trend="down"
          loading={false}
          onClick={() => navigate('/lab-inventory/list')}
        />
        <KPICard 
          title="Expired stock"
          value={inventoryStats.expiredCount}
          sub="Disposal required"
          icon={Archive}
          gradient="from-rose-500 to-rose-600"
          trend="down"
          loading={false}
          onClick={() => navigate('/lab-inventory/list')}
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Testing Activity Trend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-905 dark:text-white">Monthly Quality Testing Volume</h2>
            </div>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 px-2 py-0.5 rounded font-semibold">Last 6 Months</span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTestingVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 10 }} stroke="#94A3B8" />
                <YAxis tickLine={false} tick={{ fontSize: 10 }} stroke="#94A3B8" />
                <RechartsTooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Raw Materials" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorRM)" />
                <Area type="monotone" dataKey="Production Batches" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorProd)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quality Decisions Outcome */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Inspection Decisions (30d)
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold">Breakdown of passed, failed, and re-sample decisions</p>
          </div>
          
          <div className="h-[180px] w-full relative flex items-center justify-center my-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {displayPieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={pieData.length > 0 ? PIE_COLORS[index % PIE_COLORS.length] : '#94A3B8'} 
                    />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val) => [`${val} tests`, 'Decision']} contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{totalTestsCount}</span>
              <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider">Total Evaluated</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {pieData.length > 0 ? (
              displayPieData.map((d, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-50 dark:border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 text-slate-650 dark:text-slate-350">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="font-semibold">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {d.value} <span className="text-[10px] font-normal text-slate-450">({((d.value / totalTestsCount) * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-400 font-semibold py-2">
                No quality testing logs found for this period.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Task Queues & Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pending Inspections Queue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-slate-905 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-violet-500" />
                  Active Inspection Queues
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold">Select an item below to perform testing and record decisions</p>
              </div>

              {/* Queue switcher tabs */}
              <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-0.5 self-stretch sm:self-auto">
                <button
                  onClick={() => setPendingTab('rm')}
                  className={`flex-1 sm:flex-none px-3.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    pendingTab === 'rm'
                      ? 'bg-white dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                      : 'text-slate-555 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Raw Materials ({pendingTests.rm.length})
                </button>
                <button
                  onClick={() => setPendingTab('production')}
                  className={`flex-1 sm:flex-none px-3.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    pendingTab === 'production'
                      ? 'bg-white dark:bg-slate-900 text-indigo-655 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                      : 'text-slate-555 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Production Batches ({pendingTests.production.length})
                </button>
              </div>
            </div>

            {/* List Queue */}
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {pendingTab === 'rm' ? (
                pendingTests.rm.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-slate-500 font-bold">No pending Raw Material tests</p>
                  </div>
                ) : (
                  pendingTests.rm.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => handlePendingClick(item)}
                      className="group border border-slate-200/60 dark:border-slate-800 bg-slate-50/30 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-950/50 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-905 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.materialName}
                          </span>
                          <span className="font-mono text-[9px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            {item.referenceNo}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold">
                          <span className="flex items-center gap-1"><Package className="w-3 h-3 text-slate-350" /> {item.itemCount} items</span>
                          <span>Supplier: <strong className="text-slate-500 dark:text-slate-400">{item.supplierName}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold">
                          {format(new Date(item.createdAt), 'dd MMM, HH:mm')}
                        </span>
                        <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                pendingTests.production.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-slate-500 font-bold">No production batches awaiting QC</p>
                  </div>
                ) : (
                  pendingTests.production.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => handlePendingClick(item)}
                      className="group border border-slate-200/60 dark:border-slate-800 bg-slate-50/30 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-950/50 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-905 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.productName}
                          </span>
                          <span className="font-mono text-[9px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            {item.batchNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-355" /> 
                            Qty: <strong className="text-slate-500 dark:text-slate-400">{Number(item.quantity).toFixed(0)} {item.unit}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-405 font-bold">
                          {format(new Date(item.updatedAt), 'dd MMM, HH:mm')}
                        </span>
                        <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-650 dark:text-indigo-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-400 font-semibold">
            <span>Click any item to route directly to inspection detail page.</span>
          </div>
        </div>

        {/* Low Stock Lab Inventory */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[420px]">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Critical & Low Lab Items
              </h2>
              <p className="text-[10px] text-slate-400 font-semibold">Reagents and chemicals below safety levels or expired</p>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {lowStockLabItems.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-slate-500 font-bold">All lab inventory levels sufficient</p>
                </div>
              ) : (
                lowStockLabItems.map(item => {
                  const now = new Date();
                  const isExpired = item.expiryDate && new Date(item.expiryDate) <= now;
                  const stock = Number(item.currentStock);
                  const min = Number(item.minimumStockLevel);
                  
                  let badgeText = 'Low Stock';
                  let badgeCls = 'bg-amber-100 text-amber-700 dark:bg-amber-500/25 dark:text-amber-400 border border-amber-500/20';
                  
                  if (isExpired) {
                    badgeText = 'Expired';
                    badgeCls = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-550/20';
                  } else if (stock <= 0) {
                    badgeText = 'Critical';
                    badgeCls = 'bg-rose-100 text-rose-700 dark:bg-rose-500/25 dark:text-rose-455 border border-rose-500/20';
                  }

                  return (
                    <div 
                      key={item.id}
                      onClick={() => navigate('/lab-inventory/list', { state: { search: item.name } })}
                      className="border border-slate-100 dark:border-slate-800 hover:border-slate-205 dark:hover:border-slate-700 p-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:shadow-sm transition-all"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.name}</span>
                        <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
                          <span className={`px-1.5 py-0.2 rounded uppercase ${CATEGORY_COLORS[item.itemCategory] || ''}`}>
                            {item.itemCategory}
                          </span>
                          <span>Storage: <strong className="text-slate-500">{item.storageCondition || 'Room Temp'}</strong></span>
                        </div>
                      </div>
                      <div className="text-right space-y-1 flex-shrink-0">
                        <span className="font-bold text-slate-905 dark:text-white block">
                          {stock} <span className="text-[10px] text-slate-400 font-normal">{item.uom}</span>
                        </span>
                        <span className={`inline-block px-1.5 py-0.2 rounded-[5px] text-[8px] font-black uppercase ${badgeCls}`}>
                          {badgeText}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/lab-inventory/list')}
            className="w-full text-xs font-bold rounded-xl border-slate-200 dark:border-slate-800 text-indigo-650 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850 h-9"
          >
            Manage Lab Inventory
          </Button>
        </div>

      </div>

      {/* History Log Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-905 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Quality Inspection Logs & Reagent Consumption
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold">Real-time audit records of lab activities and completed evaluations</p>
          </div>

          {/* Log Switcher Tab */}
          <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-0.5 self-stretch sm:self-auto">
            {[
              { id: 'rm', label: 'Recent RM Tests' },
              { id: 'production', label: 'Batch QC Tests' },
              { id: 'usage', label: 'Reagent Usages' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setRecentTab(tab.id)}
                className={`px-3.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  recentTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/20'
                    : 'text-slate-550 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Table Layout */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/60 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                {recentTab === 'rm' && (
                  <>
                    <th className="p-3">Reference No</th>
                    <th className="p-3">Material Name</th>
                    <th className="p-3">Tested By</th>
                    <th className="p-3">Decision</th>
                    <th className="p-3">Tested Date</th>
                    <th className="p-3 text-right">Action</th>
                  </>
                )}
                {recentTab === 'production' && (
                  <>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Result</th>
                    <th className="p-3">Action Type</th>
                    <th className="p-3">Tested By</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3 text-right">Action</th>
                  </>
                )}
                {recentTab === 'usage' && (
                  <>
                    <th className="p-3">Reagent Used</th>
                    <th className="p-3">Qty Consumed</th>
                    <th className="p-3">Linked Inspection</th>
                    <th className="p-3">Logged By</th>
                    <th className="p-3">Usage Date</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {recentTab === 'rm' && (
                recentRmResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">No recent raw material tests logged.</td>
                  </tr>
                ) : (
                  recentRmResults.map(test => (
                    <tr key={test.id} className="border-b border-slate-100/60 dark:border-slate-800/40 hover:bg-slate-50/30 dark:hover:bg-slate-950/20">
                      <td className="p-3 font-mono font-bold text-indigo-650 dark:text-indigo-400">{test.grn?.referenceNo || '—'}</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{test.grn?.po?.name || '—'}</td>
                      <td className="p-3 font-medium text-slate-650 dark:text-slate-350">{test.tester?.name || '—'}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          test.overallDecision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                          test.overallDecision === 'REJECTED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                        }`}>
                          {test.overallDecision || 'NEED_SAMPLE'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-500">{format(new Date(test.createdAt), 'dd MMM yyyy, HH:mm')}</td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="xs" 
                          onClick={() => handleRecentTestClick(test, 'rm')}
                          className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {recentTab === 'production' && (
                recentProdResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">No recent batch QC tests logged.</td>
                  </tr>
                ) : (
                  recentProdResults.map(test => (
                    <tr key={test.id} className="border-b border-slate-100/60 dark:border-slate-800/40 hover:bg-slate-50/30 dark:hover:bg-slate-950/20">
                      <td className="p-3 font-mono font-bold text-indigo-650 dark:text-indigo-400">{test.batch?.referenceNo || '—'}</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{test.batch?.product?.name || '—'}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          test.result?.toLowerCase() === 'pass' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                          'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-455'
                        }`}>
                          {test.result}
                        </span>
                      </td>
                      <td className="p-3 uppercase font-extrabold text-[9px] text-slate-400">{test.action || '—'}</td>
                      <td className="p-3 font-medium text-slate-650 dark:text-slate-350">{test.tester?.name || '—'}</td>
                      <td className="p-3 font-medium text-slate-500">
                        {test.expiryDate ? format(new Date(test.expiryDate), 'dd MMM yyyy') : 'N/A'}
                      </td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="xs" 
                          onClick={() => handleRecentTestClick(test, 'production')}
                          className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {recentTab === 'usage' && (
                recentUsages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">No chemical consumption records logged.</td>
                  </tr>
                ) : (
                  recentUsages.map(usage => (
                    <tr key={usage.id} className="border-b border-slate-100/60 dark:border-slate-800/40 hover:bg-slate-50/30 dark:hover:bg-slate-950/20">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{usage.labItem?.name || '—'}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {usage.quantityUsed} <span className="text-[10px] text-slate-400 font-normal">{usage.labItem?.uom}</span>
                      </td>
                      <td className="p-3 font-medium text-indigo-650 dark:text-indigo-400">
                        {usage.labTest?.grn?.referenceNo ? (
                          <span 
                            onClick={() => navigate(`/lab/test/${usage.labTest.grnId}`)}
                            className="hover:underline cursor-pointer flex items-center gap-0.5 w-max"
                          >
                            {usage.labTest.grn.referenceNo} <ArrowUpRight className="w-2.5 h-2.5 inline" />
                          </span>
                        ) : 'Production Batch / Setup'}
                      </td>
                      <td className="p-3 font-medium text-slate-655 dark:text-slate-350">{usage.user?.name || '—'}</td>
                      <td className="p-3 font-medium text-slate-500">{format(new Date(usage.createdAt), 'dd MMM yyyy, HH:mm')}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

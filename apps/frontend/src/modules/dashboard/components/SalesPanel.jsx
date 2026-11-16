import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Award,
  Truck,
  Users,
  AlertCircle,
  PlusCircle,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';

const formatRupees = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function SalesPanel({
  revenueData = {},
  pipelineData = {},
  topSkus = [],
  topCustomersData,
  topCustomers,
  daysRange,
  onRangeChange,
  revenueDays = 30,
  setRevenueDays,
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();

  const selectedDays = daysRange !== undefined ? daysRange : revenueDays;
  const changeDays = onRangeChange || setRevenueDays || (() => {});

  const safeTrend = Array.isArray(revenueData?.trend)
    ? revenueData.trend
    : Array.isArray(revenueData)
    ? revenueData
    : Array.isArray(revenueData?.dailySales)
    ? revenueData.dailySales
    : [];

  // Extract pipeline counts safely - handling both pipeline and pipelineCounts structures
  const rawPipeline = pipelineData?.pipeline || pipelineData?.pipelineCounts || (
    pipelineData && typeof pipelineData === 'object' && !Array.isArray(pipelineData) ? pipelineData : {}
  );
  
  // Clean pipeline so it only contains valid status key -> primitive numeric count pairs
  const pipeline = {};
  if (rawPipeline && typeof rawPipeline === 'object') {
    for (const [key, val] of Object.entries(rawPipeline)) {
      if (['todayDeliveries', 'deliveriesToday', 'shortfalls', 'shortfallAlerts', 'pipelineCounts', 'pipeline'].includes(key)) {
        continue;
      }
      if (typeof val === 'number') {
        pipeline[key] = val;
      } else if (typeof val === 'string' && !isNaN(Number(val))) {
        pipeline[key] = Number(val);
      } else if (val && typeof val === 'object') {
        pipeline[key] = Number(val.count ?? val.value ?? val.qty ?? 0);
      }
    }
  }

  const deliveries = Array.isArray(pipelineData?.deliveriesToday)
    ? pipelineData.deliveriesToday
    : Array.isArray(pipelineData?.todayDeliveries)
    ? pipelineData.todayDeliveries
    : Array.isArray(pipelineData)
    ? pipelineData
    : [];

  const custData = topCustomersData || topCustomers || {};
  const distributors = Array.isArray(custData?.distributors)
    ? custData.distributors
    : Array.isArray(custData)
    ? custData
    : [];

  const shortfalls = Array.isArray(custData?.shortfallAlerts)
    ? custData.shortfallAlerts
    : Array.isArray(pipelineData?.shortfalls)
    ? pipelineData.shortfalls
    : [];

  return (
    <div className="space-y-3">
      {/* ── PAIR 1: Revenue Line Chart (7) + Top 5 SKUs (5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Col 7: Revenue Chart */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <FioriCard
            eyebrow="Commercial Velocity"
            title="Daily Sales Revenue & Target Pace"
            icon={TrendingUp}
            redirectRoute="/sales/order"
            updatedAt={updatedAt}
            action={
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => changeDays(d)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                      selectedDays === d
                        ? 'bg-[#0A6ED1] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            }
          >
            {isLoading ? (
              <FioriSkeleton rows={4} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : (
              <div className="flex-1 flex flex-col justify-between min-h-[220px]">
                {/* Summary Row */}
                <div className="grid grid-cols-3 gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Today</div>
                    <div className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
                      {formatRupees(revenueData.todayRevenue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Month to Date</div>
                    <div className="font-mono text-sm font-black text-[#0A6ED1] dark:text-blue-400">
                      {formatRupees(revenueData.mtdRevenue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Monthly Pace</div>
                    <div className="font-mono text-sm font-black text-[#107E3E] dark:text-emerald-400">
                      {revenueData.pacePercent || 0}%
                    </div>
                  </div>
                </div>

                {/* Line Chart */}
                <div className="flex-1 w-full min-h-[170px]">
                  {safeTrend.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic py-8">
                      No sales trend recorded for the selected window.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={safeTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <Tooltip
                          formatter={(val, name) => [formatRupees(val), name === 'target' ? 'Daily Target' : 'Actual Revenue']}
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: 6, border: 'none', color: '#f8fafc', fontSize: 11 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="revenue" name="Actual Revenue" stroke="#0A6ED1" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="target" name="Daily Target" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </FioriCard>
        </div>

        {/* Col 5: Top 5 SKUs */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <FioriCard
            eyebrow="Fast Moving Items"
            title="Top 5 Selling SKUs"
            icon={Award}
            redirectRoute="/sales/order"
            updatedAt={updatedAt}
          >
            {isLoading ? (
              <FioriSkeleton rows={5} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : topSkus.length === 0 ? (
              <FioriEmptyState title="No Sales History" message="No product orders recorded yet." />
            ) : (
              <div className="flex-1 flex flex-col justify-between space-y-2">
                {topSkus.map((sku, idx) => (
                  <div
                    key={sku.id || idx}
                    className="p-2 rounded bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0A6ED1] dark:bg-blue-950 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{sku.productName}</div>
                        <div className="font-mono text-[9.5px] text-slate-400">
                          {sku.unitsSold?.toLocaleString('en-IN')} units sold • Stock: <strong className="text-slate-700 dark:text-slate-300">{sku.currentStock?.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-right shrink-0">
                      {formatRupees(sku.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FioriCard>
        </div>
      </div>

      {/* ── PAIR 2: Dispatch Pipeline & Deliveries (7) + Top Distributors & Shortfalls (5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Col 7: Dispatch Pipeline & Today's Deliveries */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <FioriCard
            eyebrow="Order Fulfillment"
            title="Dispatch Pipeline & Today's Deliveries"
            icon={Truck}
            redirectRoute="/sales/order"
            updatedAt={updatedAt}
          >
            {isLoading ? (
              <FioriSkeleton rows={4} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : (
              <div className="flex-1 flex flex-col justify-between space-y-3">
                {/* Pipeline Stages Mini Pills */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">
                  {Object.entries(pipeline).map(([st, cnt]) => {
                    const displayCount = (cnt !== null && typeof cnt === 'object')
                      ? (cnt.count ?? cnt.value ?? cnt.qty ?? 0)
                      : (typeof cnt === 'number' || typeof cnt === 'string' ? cnt : 0);
                    return (
                      <div key={st} className="p-1.5 rounded bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                        <div className="font-mono text-sm font-black text-slate-800 dark:text-slate-100">{displayCount}</div>
                        <div className="text-[9px] font-bold text-slate-500 truncate">{st}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Today's Scheduled Delivery Table */}
                <div className="flex-1 overflow-x-auto">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Scheduled For Today
                  </div>
                  {deliveries.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic">
                      No deliveries scheduled for today yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[10px] font-bold text-slate-500 uppercase">
                          <th className="py-1 px-1">Order Ref</th>
                          <th className="py-1 px-1">Customer</th>
                          <th className="py-1 px-1">Amount</th>
                          <th className="py-1 px-1 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {deliveries.map((d) => (
                          <tr key={d.id} onClick={() => navigate(`/sales/order`)} className="hover:bg-slate-50 cursor-pointer">
                            <td className="py-1.5 px-1 font-mono font-bold text-[#0A6ED1] dark:text-blue-400">
                              {d.referenceNo}
                            </td>
                            <td className="py-1.5 px-1 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                              {d.customerName}
                            </td>
                            <td className="py-1.5 px-1 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {formatRupees(d.grandTotal)}
                            </td>
                            <td className="py-1.5 px-1 text-right">
                              <FioriStatusPill status={d.status} type={d.status} size="xs" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </FioriCard>
        </div>

        {/* Col 5: Top Distributors & Shortfall Alerts */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <FioriCard
            eyebrow="Channel & Stock Deficit"
            title="Top Distributors & Shortfall Alerts"
            icon={Users}
            redirectRoute="/sales/order"
            updatedAt={updatedAt}
          >
            {isLoading ? (
              <FioriSkeleton rows={4} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : (
              <div className="flex-1 flex flex-col justify-between space-y-2.5">
                {/* Distributors list */}
                <div className="space-y-1.5">
                  {distributors.slice(0, 3).map((dist) => (
                    <div
                      key={dist.id}
                      className="p-1.5 px-2 rounded bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{dist.customerName}</div>
                        <div className="text-[10px] text-slate-400">{dist.orderCount} orders • {formatRupees(dist.revenue)}</div>
                      </div>
                      <FioriStatusPill status={dist.paymentStatus} type={dist.paymentStatus} size="xs" />
                    </div>
                  ))}
                </div>

                {/* Shortfall Alert Box */}
                {shortfalls.length > 0 && (
                  <div className="p-2 rounded bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
                    <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-bold text-[11px] mb-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Stock Shortfall Deficit</span>
                    </div>
                    <div className="text-[10.5px] text-rose-700 dark:text-rose-400 mb-1.5">
                      {shortfalls.length} customer orders require manufacturing to fulfill cold-room deficit.
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/production/standard/add')}
                      className="w-full py-1 rounded bg-[#0A6ED1] hover:bg-blue-700 text-white text-[10.5px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      Schedule Production Order
                    </button>
                  </div>
                )}
              </div>
            )}
          </FioriCard>
        </div>
      </div>
    </div>
  );
}

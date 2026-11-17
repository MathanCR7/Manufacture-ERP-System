import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Award,
  ShoppingCart,
  Boxes,
  Eye,
  X,
  Search,
  Filter,
  ArrowUpRight,
  Package,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';
import DashboardDatePeriodFilter from './DashboardDatePeriodFilter';

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
  salesPeriod: propSalesPeriod,
  setSalesPeriod: propSetSalesPeriod,
  salesCustomRange: propSalesCustomRange,
  setSalesCustomRange: propSetSalesCustomRange,
  daysRange,
  onRangeChange,
  revenueDays = '7d',
  setRevenueDays,
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();

  // Internal period state for fallback / standalone usage
  const [internalPeriod, setInternalPeriod] = useState(
    propSalesPeriod || (typeof revenueDays === 'string' ? revenueDays : (revenueDays === 7 ? '7d' : '7d'))
  );
  const [internalCustomRange, setInternalCustomRange] = useState(
    propSalesCustomRange || { startDate: '', endDate: '' }
  );

  const activePeriod = propSalesPeriod || internalPeriod;
  const activeCustomRange = propSalesCustomRange || internalCustomRange;

  const handlePeriodChange = (newPeriod, newCustomRange) => {
    if (propSetSalesPeriod) propSetSalesPeriod(newPeriod);
    if (setRevenueDays) setRevenueDays(newPeriod);
    if (onRangeChange) onRangeChange(newPeriod);
    setInternalPeriod(newPeriod);
    if (newCustomRange) {
      if (propSetSalesCustomRange) propSetSalesCustomRange(newCustomRange);
      setInternalCustomRange(newCustomRange);
    }
  };

  const periodLabel = useMemo(() => {
    if (activePeriod === 'all_time' || activePeriod === 'all') return 'All Time';
    if (activePeriod === '7d' || activePeriod === '7') return 'Last 7D';
    if (activePeriod === 'this_month') return 'This Month';
    if (activePeriod === 'last_month') return 'Last Month';
    if (activePeriod === 'this_year') return 'This Year';
    if (activePeriod === 'custom') {
      if (activeCustomRange?.startDate && activeCustomRange?.endDate) {
        return `${activeCustomRange.startDate} → ${activeCustomRange.endDate}`;
      }
      return 'Custom Range';
    }
    return `Last ${activePeriod}D`;
  }, [activePeriod, activeCustomRange]);

  const periodTotalLabel = useMemo(() => {
    if (activePeriod === 'all_time' || activePeriod === 'all') return 'All Time Total';
    if (activePeriod === 'this_month') return 'Month to Date';
    if (activePeriod === 'last_month') return 'Last Month';
    if (activePeriod === 'this_year') return 'Year to Date';
    if (activePeriod === '7d' || activePeriod === '7') return 'Last 7 Days';
    return 'Period Total';
  }, [activePeriod]);

  // Modal State for "View More" Order-Wise Raw Materials
  const [showViewMoreModal, setShowViewMoreModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState('ALL');

  const safeTrend = Array.isArray(revenueData?.trend)
    ? revenueData.trend
    : Array.isArray(revenueData)
    ? revenueData
    : Array.isArray(revenueData?.dailySales)
    ? revenueData.dailySales
    : [];

  // PO Purchase Data
  const totalPOs = pipelineData?.totalPOs || 0;
  const totalPoSpend = pipelineData?.totalPoSpend || 0;
  const poStatuses = pipelineData?.statusCounts || { Received: 0, Approved: 0, Pending: 0 };
  const monthlyTrend = Array.isArray(pipelineData?.monthlyTrend) ? pipelineData.monthlyTrend : [];
  const recentDeliveries = Array.isArray(pipelineData?.recentDeliveries)
    ? pipelineData.recentDeliveries
    : Array.isArray(pipelineData?.deliveriesToday)
    ? pipelineData.deliveriesToday
    : [];

  // Raw Material Procurement Data
  const custData = topCustomersData || topCustomers || {};
  const topPurchasingRM = Array.isArray(custData?.topPurchasingRM)
    ? custData.topPurchasingRM
    : Array.isArray(custData?.distributors)
    ? custData.distributors.map(d => ({
        rmId: d.id,
        name: d.customerName,
        totalQty: d.quantity || 0,
        uom: d.uom || 'kg',
        totalAmount: d.revenue || 0,
        orderCount: d.orderCount || 1
      }))
    : [];

  const allOrderWiseRM = Array.isArray(custData?.allOrderWiseRM) ? custData.allOrderWiseRM : [];

  // Filtered order-wise list for "View More" modal
  const filteredOrderWiseRM = useMemo(() => {
    return allOrderWiseRM.filter(item => {
      const matchesSearch =
        !modalSearch ||
        item.poReference?.toLowerCase().includes(modalSearch.toLowerCase()) ||
        item.rawMaterialName?.toLowerCase().includes(modalSearch.toLowerCase()) ||
        item.rmId?.toLowerCase().includes(modalSearch.toLowerCase()) ||
        item.supplierName?.toLowerCase().includes(modalSearch.toLowerCase());

      const matchesStatus =
        modalStatusFilter === 'ALL' ||
        (item.status || '').toUpperCase() === modalStatusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [allOrderWiseRM, modalSearch, modalStatusFilter]);

  return (
    <div className="space-y-3">
      {/* ── PAIR 1: Revenue Line Chart (7) + Top 5 SKUs (5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Col 7: Revenue Chart (Tax Invoices Only) */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <FioriCard
            eyebrow="Commercial Velocity"
            title="Daily Sales Revenue & Target Pace"
            icon={TrendingUp}
            redirectRoute="/sales/order"
            updatedAt={updatedAt}
            action={
              <DashboardDatePeriodFilter
                activePeriod={activePeriod}
                onPeriodChange={handlePeriodChange}
                customRange={activeCustomRange}
                onCustomRangeChange={(r) => {
                  if (propSetSalesCustomRange) propSetSalesCustomRange(r);
                  setInternalCustomRange(r);
                }}
                badge={
                  <span className="hidden xl:inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-[#107E3E] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Tax Invoices Only
                  </span>
                }
              />
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
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Today (Invoiced)</div>
                    <div className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">
                      {formatRupees(revenueData.todayRevenue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{periodTotalLabel} (Invoiced)</div>
                    <div className="font-mono text-sm font-black text-[#0A6ED1] dark:text-blue-400">
                      {formatRupees(
                        revenueData.periodRevenue !== undefined
                          ? revenueData.periodRevenue
                          : revenueData.mtdRevenue || 0
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                      {activePeriod === 'this_year' ? 'Annual Pace' : 'Target Pace'}
                    </div>
                    <div className="font-mono text-sm font-black text-[#107E3E] dark:text-emerald-400">
                      {revenueData.pacePercent || 0}%
                    </div>
                  </div>
                </div>

                {/* Line Chart */}
                <div className="flex-1 w-full min-h-[170px]">
                  {safeTrend.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 italic py-8">
                      No statutory tax invoices posted in this window.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={safeTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={{ stroke: '#cbd5e1' }}
                          tickLine={false}
                          interval="preserveStartEnd"
                          minTickGap={15}
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <Tooltip
                          formatter={(val, name) => [
                            formatRupees(val),
                            name === 'target'
                              ? revenueData?.mode === 'monthly'
                                ? 'Monthly Target'
                                : 'Daily Target'
                              : 'Invoiced Revenue'
                          ]}
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: 6, border: 'none', color: '#f8fafc', fontSize: 11 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Invoiced Revenue"
                          stroke="#0A6ED1"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="target"
                          name={revenueData?.mode === 'monthly' ? 'Monthly Target' : 'Daily Target'}
                          stroke="#e11d48"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </FioriCard>
        </div>

        {/* Col 5: Top 5 SKUs (Strictly Invoiced Sales) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <FioriCard
            eyebrow="Fast Moving Items"
            title="Top 5 Selling SKUs (Invoiced)"
            icon={Award}
            redirectRoute="/sales/order"
            updatedAt={updatedAt}
            action={
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#0A6ED1] dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {periodLabel}
              </span>
            }
          >
            {isLoading ? (
              <FioriSkeleton rows={5} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : topSkus.length === 0 ? (
              <FioriEmptyState
                title="No Invoiced Sales in this Period"
                message={`No statutory tax invoices found for ${periodLabel}. Try selecting 'Last Month' or 'This Year' to view invoices.`}
              />
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
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {sku.productName}
                          {sku.code && <span className="ml-1 text-[10px] font-mono text-slate-400">({sku.code})</span>}
                        </div>
                        <div className="font-mono text-[9.5px] text-slate-400">
                          {sku.unitsSold?.toLocaleString('en-IN')} {sku.unit || 'pcs'} invoiced • Stock:{' '}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {sku.currentStock?.toLocaleString('en-IN')}
                          </strong>
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

      {/* ── PAIR 2: PO Purchase Chart (7) + Top Purchasing Raw Material (5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Col 7: PO Purchase Chart & Analytics */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <FioriCard
            eyebrow="Purchase & Procurement"
            title="PO Purchase Chart"
            icon={ShoppingCart}
            redirectRoute="/purchase/po"
            updatedAt={updatedAt}
            action={
              <button
                type="button"
                onClick={() => navigate('/purchase/po')}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-[#0A6ED1] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer flex items-center gap-1"
                title="Open Purchase Orders Management (/purchase/po)"
              >
                <span>/purchase/po</span>
                <ArrowUpRight className="w-2.5 h-2.5 opacity-70" />
              </button>
            }
          >
            {isLoading ? (
              <FioriSkeleton rows={4} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : (
              <div className="flex-1 flex flex-col justify-between space-y-3">
                {/* PO Status & Spend Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <div className="text-[9.5px] font-bold text-slate-400 uppercase">Total POs</div>
                    <div className="font-mono text-base font-black text-slate-800 dark:text-slate-100">{totalPOs}</div>
                    <div className="text-[9px] text-slate-400">{formatRupees(totalPoSpend)}</div>
                  </div>

                  <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <div className="text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Received</div>
                    <div className="font-mono text-base font-black text-[#107E3E] dark:text-emerald-400">
                      {poStatuses.Received || 0}
                    </div>
                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400">Delivered / GRN</div>
                  </div>

                  <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                    <div className="text-[9.5px] font-bold text-blue-800 dark:text-blue-300 uppercase">Approved</div>
                    <div className="font-mono text-base font-black text-[#0A6ED1] dark:text-blue-400">
                      {poStatuses.Approved || 0}
                    </div>
                    <div className="text-[9px] text-blue-600 dark:text-blue-400">Ready to Ship</div>
                  </div>

                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                    <div className="text-[9.5px] font-bold text-amber-800 dark:text-amber-300 uppercase">Pending</div>
                    <div className="font-mono text-base font-black text-amber-700 dark:text-amber-400">
                      {poStatuses.Pending || 0}
                    </div>
                    <div className="text-[9px] text-amber-600 dark:text-amber-400">Awaiting Action</div>
                  </div>
                </div>

                {/* Monthly PO Spend Bar Chart */}
                {monthlyTrend.length > 0 && (
                  <div className="h-28 w-full">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Procurement Spend Trend (Monthly)
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} />
                        <Tooltip
                          formatter={(val) => [formatRupees(val), 'PO Spend']}
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: 6, border: 'none', color: '#f8fafc', fontSize: 11 }}
                        />
                        <Bar dataKey="spend" name="Spend (₹)" fill="#0A6ED1" radius={[4, 4, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Recent Purchase Orders Table */}
                <div className="flex-1 overflow-x-auto">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                    <span>Recent Purchase Orders</span>
                    <span className="text-[9.5px] text-slate-400 font-normal">Latest vendor purchase dispatches</span>
                  </div>
                  {recentDeliveries.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic">
                      No purchase orders registered yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[10px] font-bold text-slate-500 uppercase">
                          <th className="py-1 px-1">PO Ref</th>
                          <th className="py-1 px-1">Supplier</th>
                          <th className="py-1 px-1">Raw Material</th>
                          <th className="py-1 px-1">Qty</th>
                          <th className="py-1 px-1">Amount</th>
                          <th className="py-1 px-1 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {recentDeliveries.slice(0, 4).map((d) => (
                          <tr
                            key={d.id}
                            onClick={() => navigate('/purchase/po')}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                          >
                            <td className="py-1.5 px-1 font-mono font-bold text-[#0A6ED1] dark:text-blue-400">
                              {d.referenceNo}
                            </td>
                            <td className="py-1.5 px-1 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                              {d.supplierName}
                            </td>
                            <td className="py-1.5 px-1 text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                              {d.rawMaterialName}
                            </td>
                            <td className="py-1.5 px-1 font-mono text-slate-700 dark:text-slate-300">
                              {Number(d.quantity || 0).toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] text-slate-400">{d.uom}</span>
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

        {/* Col 5: Top Purchasing Raw Material (with "View More" Modal) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <FioriCard
            eyebrow="Raw Material Procurement"
            title="Top Purchasing Raw Material"
            icon={Boxes}
            redirectRoute="/purchase/po"
            updatedAt={updatedAt}
            action={
              <button
                type="button"
                onClick={() => setShowViewMoreModal(true)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0A6ED1] hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="View all raw materials order-wise with live UOM"
              >
                <span>View More</span>
                <Eye className="w-3 h-3" />
              </button>
            }
          >
            {isLoading ? (
              <FioriSkeleton rows={4} height="h-64" />
            ) : error ? (
              <FioriErrorRetry error={error} onRetry={onRetry} />
            ) : (
              <div className="flex-1 flex flex-col justify-between space-y-2.5">
                {/* Top Raw Materials List */}
                {topPurchasingRM.length === 0 ? (
                  <FioriEmptyState title="No Purchase History" message="No raw material PO orders recorded yet." />
                ) : (
                  <div className="space-y-1.5">
                    {topPurchasingRM.slice(0, 5).map((rm, idx) => (
                      <div
                        key={rm.rmId || idx}
                        className="p-2 rounded bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0A6ED1] dark:bg-blue-950 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-slate-100 truncate" title={rm.name}>
                              {rm.name}
                            </div>
                            <div className="font-mono text-[9.5px] text-slate-400">
                              {Number(rm.totalQty || 0).toLocaleString('en-IN')}{' '}
                              <strong className="text-slate-700 dark:text-slate-300 font-bold">{rm.uom}</strong> •{' '}
                              {rm.orderCount} PO{rm.orderCount > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-right shrink-0">
                          {formatRupees(rm.totalAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Quick-Launch Bar */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">
                    Live raw material master UOM synchronization
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowViewMoreModal(true)}
                    className="text-[10.5px] font-bold text-[#0A6ED1] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Order-Wise</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </FioriCard>
        </div>
      </div>

      {/* ── MODAL: "VIEW MORE" ALL PURCHASED RAW MATERIALS ORDER-WISE ── */}
      {showViewMoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-rm-title"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#0A6ED1] dark:text-blue-400" />
                <div>
                  <h3 id="modal-rm-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    All Purchased Raw Materials (Order-Wise Audit)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Live procurement logs with order references and live UOMs from Raw Material Master
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowViewMoreModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-3 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search PO #, Raw Material, Code, Vendor..."
                  className="w-full pl-8 pr-3 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-[#0A6ED1]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                <select
                  value={modalStatusFilter}
                  onChange={(e) => setModalStatusFilter(e.target.value)}
                  className="text-xs px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="RECEIVED">Received</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                </select>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {filteredOrderWiseRM.length} lines
                </span>
              </div>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredOrderWiseRM.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 italic">
                  No purchase records matched your search filter.
                </div>
              ) : (
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[10px] font-bold text-slate-500 uppercase sticky top-0 bg-white dark:bg-slate-900 z-10">
                      <th className="py-2 px-2">PO Ref</th>
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Raw Material</th>
                      <th className="py-2 px-2">Supplier / Vendor</th>
                      <th className="py-2 px-2">Quantity</th>
                      <th className="py-2 px-2">Live UOM</th>
                      <th className="py-2 px-2">Unit Rate</th>
                      <th className="py-2 px-2">Total Amount</th>
                      <th className="py-2 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-normal">
                    {filteredOrderWiseRM.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2 px-2 font-mono font-bold text-[#0A6ED1] dark:text-blue-400">
                          {item.poReference}
                        </td>
                        <td className="py-2 px-2 text-slate-500 dark:text-slate-400">
                          {item.date
                            ? new Date(item.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '-'}
                        </td>
                        <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-100">
                          <div>
                            <span>{item.rawMaterialName}</span>
                            {item.rmId && (
                              <span className="ml-1 text-[9.5px] font-mono text-slate-400 dark:text-slate-500">
                                ({item.rmId})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                          {item.supplierName}
                        </td>
                        <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-slate-100">
                          {Number(item.quantity || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10.5px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {item.uom}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-400">
                          {formatRupees(item.unitPrice)}
                        </td>
                        <td className="py-2 px-2 font-mono font-black text-slate-900 dark:text-slate-100">
                          {formatRupees(item.totalAmount)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <FioriStatusPill status={item.status} type={item.status} size="xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 text-[11px]">
                Showing {filteredOrderWiseRM.length} of {allOrderWiseRM.length} total raw material order lines
              </span>
              <button
                type="button"
                onClick={() => setShowViewMoreModal(false)}
                className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

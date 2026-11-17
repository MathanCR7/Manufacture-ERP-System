import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ArrowUpRight, ThermometerSnowflake, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';
import DashboardDatePeriodFilter from './DashboardDatePeriodFilter';

export default function InboundPanel({
  inflowData = [],
  grnData,
  grns,
  inflowPeriod = '7d',
  onInflowPeriodChange,
  inflowCustomRange,
  onInflowCustomRangeChange,
  grnPeriod = 'all_time',
  onGrnPeriodChange,
  grnCustomRange,
  onGrnCustomRangeChange,
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();
  const list = (Array.isArray(grnData) && grnData.length > 0) ? grnData : (Array.isArray(grns) ? grns : []);
  const safeInflow = Array.isArray(inflowData)
    ? inflowData
    : Array.isArray(inflowData?.inflow)
    ? inflowData.inflow
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
      {/* Col 5: Inbound Receipts Volume Bar Chart */}
      <div className="lg:col-span-5 flex flex-col h-full">
        <FioriCard
          eyebrow="Inflow Volume"
          title={inflowPeriod === '7d' ? '7-Day Material Receipts' : 'Material Receipts Inflow'}
          icon={Truck}
          redirectRoute="/grn/list"
          updatedAt={updatedAt}
          action={
            <DashboardDatePeriodFilter
              activePeriod={inflowPeriod}
              onPeriodChange={onInflowPeriodChange}
              customRange={inflowCustomRange}
              onCustomRangeChange={onInflowCustomRangeChange}
            />
          }
        >
          {isLoading ? (
            <FioriSkeleton rows={4} height="h-64" />
          ) : error ? (
            <FioriErrorRetry error={error} onRetry={onRetry} />
          ) : safeInflow.length === 0 ? (
            <FioriEmptyState title="No Inbound Volume" message="No material intake logged in the selected period." />
          ) : (
            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Raw material intake weight (kg/L)
              </div>
              <div className="flex-1 w-full min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={safeInflow} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val) => [`${val} kg/L`, 'Intake Volume']}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderRadius: 6,
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: 11
                      }}
                    />
                    <Bar dataKey="qty_kg" fill="#0A6ED1" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </FioriCard>
      </div>

      {/* Col 7: Recent GRN Table with Intake Temperature Check */}
      <div className="lg:col-span-7 flex flex-col h-full">
        <FioriCard
          eyebrow="Gate Intake Inspection"
          title="Recent Goods Receipt Notes (GRN)"
          icon={ThermometerSnowflake}
          redirectRoute="/grn/list"
          updatedAt={updatedAt}
          action={
            <DashboardDatePeriodFilter
              activePeriod={grnPeriod}
              onPeriodChange={onGrnPeriodChange}
              customRange={grnCustomRange}
              onCustomRangeChange={onGrnCustomRangeChange}
            />
          }
        >
          {isLoading ? (
            <FioriSkeleton rows={5} height="h-64" />
          ) : isError || error ? (
            <FioriErrorRetry error={error} onRetry={onRetry} />
          ) : list.length === 0 ? (
            <FioriEmptyState title="No Recent GRNs" message="No gate inward receipts found." />
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap" aria-label="Recent Goods Receipts Table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-1.5 px-2">GRN No</th>
                    <th className="py-1.5 px-2">Supplier</th>
                    <th className="py-1.5 px-2">Item</th>
                    <th className="py-1.5 px-2">Qty Recv / Inv</th>
                    <th className="py-1.5 px-2">Intake Temp</th>
                    <th className="py-1.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {list.map((grn) => (
                    <tr
                      key={grn.id}
                      onClick={() => navigate(`/grn/view/${grn.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2 font-mono font-bold text-[#0A6ED1] dark:text-blue-400">
                        {grn.grnNo}
                      </td>
                      <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                        {grn.supplier}
                      </td>
                      <td className="py-2 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                        {grn.materialName}
                      </td>
                      <td className="py-2 px-2 font-mono text-[11px]">
                        <strong>{grn.receivedQty}</strong> / {grn.invoicedQty} {grn.unit}
                      </td>
                      <td className="py-2 px-2 font-mono text-[11px]">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-bold ${
                            grn.tempAlert
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {grn.tempAlert && <AlertCircle className="w-2.5 h-2.5 text-rose-600" />}
                          {grn.intakeTemp}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <FioriStatusPill status={grn.status} type={grn.status} size="xs" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FioriCard>
      </div>
    </div>
  );
}

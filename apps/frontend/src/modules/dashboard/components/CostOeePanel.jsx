import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Calculator, TrendingDown, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';

export default function CostOeePanel({
  costData = {},
  oeeData = {},
  scrapData = [],
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();

  const safeScrapData = Array.isArray(scrapData)
    ? scrapData
    : Array.isArray(scrapData?.scrap)
    ? scrapData.scrap
    : Array.isArray(scrapData?.trend)
    ? scrapData.trend
    : [];

  const oee = oeeData?.oee ?? 79.8;
  const avail = oeeData?.availability ?? 92.4;
  const perf = oeeData?.performance ?? 88.0;
  const qual = oeeData?.quality ?? 98.2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
      {/* Col 6: Production Cost Per Litre / Piece */}
      <div className="lg:col-span-6 flex flex-col h-full">
        <FioriCard
          eyebrow="Cost Intelligence"
          title="Batch Cost Per Unit & BOM Variance"
          icon={Calculator}
          redirectRoute="/production/standard"
          updatedAt={updatedAt}
        >
          {isLoading ? (
            <FioriSkeleton rows={4} height="h-64" />
          ) : error ? (
            <FioriErrorRetry error={error} onRetry={onRetry} />
          ) : (
            <div className="flex-1 flex flex-col justify-between space-y-3">
              {/* Cost Summary Header */}
              <div className="flex items-baseline justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Actual Cost / Unit</div>
                  <div className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-slate-100">
                    ₹{costData.totalCostPerUnit?.toFixed(2) || '54.00'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Standard BOM Target</div>
                  <div className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300">
                    ₹{costData.standardCostPerUnit?.toFixed(2) || '52.00'}
                  </div>
                  <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
                    Variance: +₹{costData.variance?.toFixed(2) || '2.00'}
                  </div>
                </div>
              </div>

              {/* Stacked Breakdown Row */}
              <div className="space-y-1.5 text-xs">
                <div className="text-[10.5px] font-bold text-slate-500 uppercase">Absorption Components</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">Raw Material:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      ₹{costData.rawMaterial?.toFixed(2) || '34.50'} (64%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">Electricity (EB):</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      ₹{costData.electricity?.toFixed(2) || '4.80'} (9%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">Direct Labour:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      ₹{costData.directLabour?.toFixed(2) || '6.20'} (11%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400">Packaging Film:</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      ₹{costData.packaging?.toFixed(2) || '8.50'} (16%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </FioriCard>
      </div>

      {/* Col 6: OEE Gauge & 14-Day Scrap Trend */}
      <div className="lg:col-span-6 flex flex-col h-full">
        <FioriCard
          eyebrow="Plant Productivity"
          title="OEE Score & 14-Day Scrap Rate"
          icon={Zap}
          redirectRoute="/production/batches"
          updatedAt={updatedAt}
        >
          {isLoading ? (
            <FioriSkeleton rows={4} height="h-64" />
          ) : error ? (
            <FioriErrorRetry error={error} onRetry={onRetry} />
          ) : (
            <div className="flex-1 flex flex-col justify-between space-y-3">
              {/* OEE Component Bars */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Overall Equipment Effectiveness</div>
                  <div className="text-2xl font-mono font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5">
                    <span>{oee}%</span>
                    <span className="text-xs font-normal text-slate-400">Target: 85.0%</span>
                  </div>
                </div>
                <FioriStatusPill status={oee >= 85 ? 'World Class' : 'Operational'} type={oee >= 85 ? 'good' : 'warning'} size="xs" />
              </div>

              {/* Availability, Performance, Quality trio */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="p-1 rounded bg-slate-100/60 dark:bg-slate-800/60">
                  <div className="font-mono font-bold text-[#0A6ED1] dark:text-blue-400">{avail}%</div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Availability</div>
                </div>
                <div className="p-1 rounded bg-slate-100/60 dark:bg-slate-800/60">
                  <div className="font-mono font-bold text-[#107E3E] dark:text-emerald-400">{perf}%</div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Performance</div>
                </div>
                <div className="p-1 rounded bg-slate-100/60 dark:bg-slate-800/60">
                  <div className="font-mono font-bold text-[#A65800] dark:text-amber-400">{qual}%</div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold">Quality</div>
                </div>
              </div>

              {/* 14-Day Scrap Trend Line */}
              <div className="flex-1 min-h-[110px] w-full">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>14-Day Scrap % Trend</span>
                  <span className="text-[#BB0000] font-bold">Benchmark Limit: 2.0%</span>
                </div>
                <div className="h-[90px] w-full">
                  {safeScrapData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-400 italic">
                      No scrap logs recorded for this window
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={safeScrapData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 4]} />
                        <Tooltip
                          formatter={(val) => [`${val}%`, 'Scrap Rate']}
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: 4, fontSize: 10, color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="scrapPercent" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 1.5 }} />
                        <Line type="monotone" dataKey="targetPercent" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </FioriCard>
      </div>
    </div>
  );
}

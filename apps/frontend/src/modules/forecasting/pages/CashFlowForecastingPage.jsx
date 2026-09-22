import React, { useState, useMemo } from 'react';
import {
  DollarSign, ArrowUpRight, ArrowDownRight, TrendingUp,
  ShieldAlert, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function CashFlowForecastingPage() {
  const {
    horizonPreset,
    setHorizonPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    loading,
    forecastData,
    refetch
  } = useForecastingData('30');

  // Table Pagination States
  const [cashflowPage, setCashflowPage] = useState(1);
  const [cashflowPageSize, setCashflowPageSize] = useState(10);

  const allOverdueAccounts = useMemo(() => {
    return forecastData?.cashFlowForecast?.topOverdueOrAtRiskAccounts || [];
  }, [forecastData]);

  const paginatedOverdueAccounts = useMemo(() => {
    const start = (cashflowPage - 1) * cashflowPageSize;
    return allOverdueAccounts.slice(start, start + cashflowPageSize);
  }, [allOverdueAccounts, cashflowPage, cashflowPageSize]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="Cash Flow & Payables Forecasting"
        subtitle="Expected receivables realization, scheduled supplier disbursements, and liquidity curve projection"
        icon={DollarSign}
        horizonPreset={horizonPreset}
        setHorizonPreset={setHorizonPreset}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        onRefresh={refetch}
        loading={loading}
      />

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Projected Receivables</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              ₹{Number(forecastData?.cashFlowForecast?.projectedInflowsReceivables || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Customer collections realization
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Scheduled Payables</span>
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              ₹{Number(forecastData?.cashFlowForecast?.projectedOutflowsPayables || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Supplier PO disbursements due
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Projected OpEx</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              ₹{Number(forecastData?.cashFlowForecast?.projectedOperatingExpenses || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Operating expenses ({horizonPreset}d)
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Net Cash Trajectory</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className={`text-xl font-bold tracking-tight ${
              (forecastData?.cashFlowForecast?.netLiquidityImpact || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              ₹{Number(forecastData?.cashFlowForecast?.netLiquidityImpact || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              {forecastData?.cashFlowForecast?.cashDeficitRisk ? '⚠️ Liquidity Deficit Risk' : '✨ Solvent Liquidity'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>At-Risk Accounts</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {(forecastData?.cashFlowForecast?.topOverdueOrAtRiskAccounts || []).length} Accounts
            </div>
            <div className="text-[11px] text-slate-500">
              Customers overdue &gt; 30 days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating Cash Flow Trajectory Models...</p>
          <p className="text-xs text-slate-500 mt-1">Analyzing customer collection terms, vendor payment schedules, and working capital runways...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Chart Card: Weekly Inflows vs Outflows */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Weekly Net Liquidity & Cash Flow Trajectory
                </h3>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData?.cashFlowForecast?.weeklyBreakdown || []}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="payablesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="week" stroke="#888888" fontSize={11} />
                  <YAxis stroke="#888888" fontSize={11} />
                  <RechartsTooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                  <Legend />
                  <Area type="monotone" dataKey="expectedInflows" name="Expected Collections (₹)" stroke="#10b981" fillOpacity={1} fill="url(#inflowGrad)" />
                  <Area type="monotone" dataKey="expectedPayables" name="Supplier Payables (₹)" stroke="#ef4444" fillOpacity={1} fill="url(#payablesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Overdue Accounts Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                At-Risk & Overdue Accounts (Liquidity Discount Applied)
              </h3>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Account / Party</th>
                    <th className="py-3 px-4 font-semibold">Reference</th>
                    <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
                    <th className="py-3 px-4 font-semibold text-right">Days Past Due</th>
                    <th className="py-3 px-4 font-semibold">Risk Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {allOverdueAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No overdue or high-risk collection accounts identified.
                      </td>
                    </tr>
                  ) : (
                    paginatedOverdueAccounts.map((acc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{acc.partyName}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{acc.referenceNo}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">₹{Number(acc.balance).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{acc.dueDays} days</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            {acc.riskStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
            {allOverdueAccounts.length > 0 && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <Pagination
                  currentPage={cashflowPage}
                  totalPages={Math.max(1, Math.ceil(allOverdueAccounts.length / cashflowPageSize))}
                  totalRecords={allOverdueAccounts.length}
                  pageSize={cashflowPageSize}
                  onPageChange={setCashflowPage}
                  onPageSizeChange={(newSize) => {
                    setCashflowPageSize(newSize);
                    setCashflowPage(1);
                  }}
                />
              </div>
            )}
          </Card>
        </div>
      )}

    </div>
  );
}

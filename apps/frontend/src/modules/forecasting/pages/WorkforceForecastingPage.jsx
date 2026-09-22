import React, { useState, useMemo } from 'react';
import {
  Users, Clock, Zap, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function WorkforceForecastingPage() {
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
  const [workforcePage, setWorkforcePage] = useState(1);
  const [workforcePageSize, setWorkforcePageSize] = useState(10);

  const allStageBottlenecks = useMemo(() => {
    return forecastData?.workforceCapacityForecast?.stageBottlenecks || [];
  }, [forecastData]);

  const paginatedStageBottlenecks = useMemo(() => {
    const start = (workforcePage - 1) * workforcePageSize;
    return allStageBottlenecks.slice(start, start + workforcePageSize);
  }, [allStageBottlenecks, workforcePage, workforcePageSize]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="Workforce & Capacity Forecasting"
        subtitle="Labor demand projection, shift staffing models, and machine bottleneck diagnostics"
        icon={Users}
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
              <span>Projected Workload</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.workforceCapacityForecast?.projectedWorkloadHours || 0}h
            </div>
            <div className="text-[11px] text-slate-500">
              Labor hours for pending orders
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Available Capacity</span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.workforceCapacityForecast?.availableStaffHours || 0}h
            </div>
            <div className="text-[11px] text-slate-500">
              Roster capacity over {horizonPreset}d
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Capacity Utilization</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0}%
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  (forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0) > 100
                    ? 'bg-rose-500'
                    : (forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0) > 85
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Coverage Status</span>
              <CheckCircle2 className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {forecastData?.workforceCapacityForecast?.staffShortfallOrSurplus?.text || 'Coverage Sufficient'}
            </div>
            <div className="text-[11px] text-slate-500">
              {(forecastData?.workforceCapacityForecast?.capacityUtilizationPercent || 0) > 100 ? 'Overtime / Addl staff needed' : 'Shift coverage balanced'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Stage Bottlenecks</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {(forecastData?.workforceCapacityForecast?.stageBottlenecks || []).length} Stages
            </div>
            <div className="text-[11px] text-slate-500">
              Stages exceeding 85% capacity
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating Workforce & Capacity Models...</p>
          <p className="text-xs text-slate-500 mt-1">Simulating shift coverage, stage throughput times, and machine queue loads...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Shift Coverage Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecastData?.workforceCapacityForecast?.recommendedShiftCoverage?.map((cov, idx) => (
              <Card key={idx} className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                  <span>{cov.role.replace('_', ' ')}</span>
                  <Users className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{cov.requiredHeadcount}</span>
                  <span className="text-xs text-slate-400">staff needed (Current: {cov.currentHeadcount})</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {cov.requiredHeadcount > cov.currentHeadcount ? (
                    <span className="text-rose-600 font-medium">Shortfall: +{cov.requiredHeadcount - cov.currentHeadcount} headcount required</span>
                  ) : (
                    <span className="text-emerald-600 font-medium">Coverage is sufficient</span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Stage Bottleneck Analysis Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Stage Bottleneck & Machine Workload Queue
              </h3>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Production Stage</th>
                    <th className="py-3 px-4 font-semibold text-right">Standard Time per Unit</th>
                    <th className="py-3 px-4 font-semibold text-right">Total Workload Queue</th>
                    <th className="py-3 px-4 font-semibold text-right">Orders Queued</th>
                    <th className="py-3 px-4 font-semibold">Bottleneck Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedStageBottlenecks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No production stage bottlenecks detected.
                      </td>
                    </tr>
                  ) : (
                    paginatedStageBottlenecks.map((st, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{st.stageName}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{st.standardHours} hrs</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">{st.projectedHours} hrs</td>
                        <td className="py-3 px-4 text-right text-slate-500">{st.orderCount} batches</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            st.riskLevel === 'HIGH'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : st.riskLevel === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {st.riskLevel} CONGESTION
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <Pagination
                currentPage={workforcePage}
                totalPages={Math.max(1, Math.ceil(allStageBottlenecks.length / workforcePageSize))}
                totalRecords={allStageBottlenecks.length}
                pageSize={workforcePageSize}
                onPageChange={setWorkforcePage}
                onPageSizeChange={(newSize) => {
                  setWorkforcePageSize(newSize);
                  setWorkforcePage(1);
                }}
              />
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

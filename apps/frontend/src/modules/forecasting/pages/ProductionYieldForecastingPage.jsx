import React, { useState, useMemo } from 'react';
import {
  Factory, TrendingUp, Clock, AlertTriangle, DollarSign, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function ProductionYieldForecastingPage() {
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
  const [productionPage, setProductionPage] = useState(1);
  const [productionPageSize, setProductionPageSize] = useState(10);

  const allComponentSufficiency = useMemo(() => {
    return forecastData?.manufacturingProductionForecast?.componentSufficiency || [];
  }, [forecastData]);

  const paginatedComponentSufficiency = useMemo(() => {
    const start = (productionPage - 1) * productionPageSize;
    return allComponentSufficiency.slice(start, start + productionPageSize);
  }, [allComponentSufficiency, productionPage, productionPageSize]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="Production & WIP Yield Forecasting"
        subtitle="BOM component sufficiency matrix, batch yield variance, and material shortage cost exposure"
        icon={Factory}
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
              <span>Active WIP Batches</span>
              <Factory className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.manufacturingProductionForecast?.summary?.totalActiveBatches || 0} Batches
            </div>
            <div className="text-[11px] text-slate-500">
              Batches currently in floor production
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Historical Yield</span>
              <TrendingUp className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
              {forecastData?.manufacturingProductionForecast?.summary?.averageYieldPercent || 0}%
            </div>
            <div className="text-[11px] text-slate-500">
              Output efficiency vs planned BOM
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Avg Cycle Time</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.manufacturingProductionForecast?.summary?.averageCycleTimeHours || 0}h
            </div>
            <div className="text-[11px] text-slate-500">
              Floor duration per batch run
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Component Shortages</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {(forecastData?.manufacturingProductionForecast?.componentSufficiency || []).filter(c => c.deficit > 0).length} Materials
            </div>
            <div className="text-[11px] text-slate-500">
              Raw materials with deficit
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Shortage Procurement Cost</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              ₹{Number((forecastData?.manufacturingProductionForecast?.componentSufficiency || []).reduce((s, c) => s + Number(c.estimatedPurchaseCost || 0), 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Estimated purchase outlay needed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating Production & BOM Sufficiency Matrix...</p>
          <p className="text-xs text-slate-500 mt-1">Simulating raw material bill of materials, safety buffer requirements, and yield ratios...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Factory className="w-4 h-4 text-teal-500" />
                Bill of Materials (BOM) Raw Material Shortage & Sufficiency Matrix
              </h3>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Raw Material</th>
                    <th className="py-3 px-4 font-semibold text-right">Stock On Hand</th>
                    <th className="py-3 px-4 font-semibold text-right">Required for Orders</th>
                    <th className="py-3 px-4 font-semibold text-right">Shortage / Deficit</th>
                    <th className="py-3 px-4 font-semibold">Sufficiency Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Estimated PO Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedComponentSufficiency.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No BOM component deficits detected for scheduled production runs.
                      </td>
                    </tr>
                  ) : (
                    paginatedComponentSufficiency.map(rm => (
                      <tr key={rm.rawMaterialId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          <div>{rm.rawMaterialName}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{rm.code}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                          {rm.currentStock} {rm.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                          {rm.requiredForBatch} {rm.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">
                          {rm.deficit > 0 ? `${rm.deficit} ${rm.unit}` : '0'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            rm.sufficiency === 'Shortage'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {rm.sufficiency}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                          {rm.estimatedPurchaseCost > 0 ? `₹${rm.estimatedPurchaseCost.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <Pagination
                currentPage={productionPage}
                totalPages={Math.max(1, Math.ceil(allComponentSufficiency.length / productionPageSize))}
                totalRecords={allComponentSufficiency.length}
                pageSize={productionPageSize}
                onPageChange={setProductionPage}
                onPageSizeChange={(newSize) => {
                  setProductionPageSize(newSize);
                  setProductionPage(1);
                }}
              />
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

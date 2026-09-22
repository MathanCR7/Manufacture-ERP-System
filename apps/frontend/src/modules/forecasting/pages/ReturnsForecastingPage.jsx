import React from 'react';
import {
  RotateCcw, Package, DollarSign, CheckCircle2, AlertTriangle,
  ShieldAlert, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function ReturnsForecastingPage() {
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

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="Returns & Reverse Logistics Forecasting"
        subtitle="Predictive customer return liabilities, scrap salvage ratios, and supplier rejection drivers"
        icon={RotateCcw}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Sales Return Rate</span>
              <RotateCcw className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.returnsReverseLogisticsForecast?.projectedSalesReturnRatePercent || 0}%
            </div>
            <div className="text-[11px] text-slate-500">
              Customer return frequency
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Projected Return Units</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {forecastData?.returnsReverseLogisticsForecast?.projectedSalesReturnUnits || 0} Units
            </div>
            <div className="text-[11px] text-slate-500">
              Expected reverse logistics volume
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Refund Liability</span>
              <DollarSign className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              ₹{Number(forecastData?.returnsReverseLogisticsForecast?.estimatedRefundLiabilityAmount || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Credit note payout exposure
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Resaleable Recovery</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.resaleablePercent || 0}%
            </div>
            <div className="text-[11px] text-slate-500">
              Salvaged back to active inventory
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating Returns & Reverse Logistics Forecast...</p>
          <p className="text-xs text-slate-500 mt-1">Analyzing customer RMA history, supplier QA rejects, and salvage disposition trends...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-500" />
              Customer Finished Goods Returns Projection
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-400">Projected Sales Return Rate</span>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {forecastData?.returnsReverseLogisticsForecast?.projectedSalesReturnRatePercent || 0}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-400">Estimated Refund Liability</span>
                <div className="text-xl font-bold text-rose-600 mt-1">
                  ₹{Number(forecastData?.returnsReverseLogisticsForecast?.estimatedRefundLiabilityAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Salvage Condition Breakdown:</span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Resaleable Units (Repackaged):</span>
                  <span className="font-bold text-emerald-600">{forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.resaleablePercent || 0}%</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Damaged / Discount Channel:</span>
                  <span className="font-bold text-amber-600">{forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.damagedDiscountedPercent || 0}%</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Destroyed Scrap:</span>
                  <span className="font-bold text-rose-600">{forecastData?.returnsReverseLogisticsForecast?.salvageConditionBreakdown?.destroyedScrapPercent || 0}%</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Vendor Quality Rejections & Primary Drivers
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400">Vendor Purchase Rejection Rate</span>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {forecastData?.returnsReverseLogisticsForecast?.projectedPurchaseReturnRatePercent || 0}%
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Primary Root-Cause Drivers:</span>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                {(forecastData?.returnsReverseLogisticsForecast?.primaryRejectionDrivers || []).length === 0 ? (
                  <li className="text-slate-400 italic">No significant supplier defect clusters reported.</li>
                ) : (
                  forecastData?.returnsReverseLogisticsForecast?.primaryRejectionDrivers?.map((driver, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{driver}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

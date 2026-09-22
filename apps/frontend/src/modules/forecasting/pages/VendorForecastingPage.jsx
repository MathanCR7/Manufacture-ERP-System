import React, { useState, useMemo } from 'react';
import {
  Truck, CheckCircle2, Clock, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function VendorForecastingPage() {
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
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(10);

  const allVendorForecast = useMemo(() => {
    return forecastData?.vendorLeadTimeForecast || [];
  }, [forecastData]);

  const paginatedVendorForecast = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return allVendorForecast.slice(start, start + vendorPageSize);
  }, [allVendorForecast, vendorPage, vendorPageSize]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="Vendor & Lead-Time Forecasting"
        subtitle="Supplier reliability metrics, lead-time variance tracking, and safety buffer calibration"
        icon={Truck}
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
              <span>Suppliers Monitored</span>
              <Truck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {(forecastData?.vendorLeadTimeForecast || []).length} Vendors
            </div>
            <div className="text-[11px] text-slate-500">
              Active raw material suppliers
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>On-Time Delivery (OTD)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {(() => {
                const list = forecastData?.vendorLeadTimeForecast || [];
                return list.length > 0 ? (list.reduce((s, v) => s + v.onTimeDeliveryRatePercent, 0) / list.length).toFixed(1) : '0.0';
              })()}%
            </div>
            <div className="text-[11px] text-slate-500">
              Historical promptness rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Quality Acceptance</span>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {(() => {
                const list = forecastData?.vendorLeadTimeForecast || [];
                return list.length > 0 ? (list.reduce((s, v) => s + v.qualityAcceptanceRatePercent, 0) / list.length).toFixed(1) : '0.0';
              })()}%
            </div>
            <div className="text-[11px] text-slate-500">
              GRN & lab QA pass rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Lead Time Variance</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {(() => {
                const list = forecastData?.vendorLeadTimeForecast || [];
                const avg = list.length > 0 ? (list.reduce((s, v) => s + v.leadTimeVarianceDays, 0) / list.length).toFixed(1) : '0.0';
                return Number(avg) > 0 ? `+${avg}d` : `${avg}d`;
              })()}
            </div>
            <div className="text-[11px] text-slate-500">
              Delivery bias vs promised date
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>High-Risk Suppliers</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {(forecastData?.vendorLeadTimeForecast || []).filter(v => v.vendorRiskScore > 0.3).length} Vendors
            </div>
            <div className="text-[11px] text-slate-500">
              Suppliers with VRI index &gt; 0.30
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating Vendor Lead-Time & Scorecards...</p>
          <p className="text-xs text-slate-500 mt-1">Evaluating historical GRN timestamps, inspection logs, and buffer days...</p>
        </Card>
      ) : (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" />
              Supplier Reliability & Lead Time Bias Scorecard
            </h3>
          </div>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Supplier Name</th>
                  <th className="py-3 px-4 font-semibold text-right">POs Tracked</th>
                  <th className="py-3 px-4 font-semibold text-right">Promised Lead Time</th>
                  <th className="py-3 px-4 font-semibold text-right">Actual Lead Time</th>
                  <th className="py-3 px-4 font-semibold text-right">Lead Time Variance</th>
                  <th className="py-3 px-4 font-semibold text-right">On-Time Delivery (OTD)</th>
                  <th className="py-3 px-4 font-semibold text-right">Quality Pass (QAR)</th>
                  <th className="py-3 px-4 font-semibold text-right">Recommended Buffer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedVendorForecast.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No vendor lead-time data available for this horizon.
                    </td>
                  </tr>
                ) : (
                  paginatedVendorForecast.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{v.supplierName}</td>
                      <td className="py-3 px-4 text-right text-slate-500">{v.totalPOsTracked}</td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{v.promisedAvgLeadTimeDays} days</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">{v.historicalAvgLeadTimeDays} days</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-semibold ${v.leadTimeVarianceDays > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {v.leadTimeVarianceDays > 0 ? `+${v.leadTimeVarianceDays}d delay` : `${v.leadTimeVarianceDays}d early`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {v.onTimeDeliveryRatePercent}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-teal-600 dark:text-teal-400">
                        {v.qualityAcceptanceRatePercent}%
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        +{v.recommendedLeadTimeBufferDays} days buffer
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <Pagination
              currentPage={vendorPage}
              totalPages={Math.max(1, Math.ceil(allVendorForecast.length / vendorPageSize))}
              totalRecords={allVendorForecast.length}
              pageSize={vendorPageSize}
              onPageChange={setVendorPage}
              onPageSizeChange={(newSize) => {
                setVendorPageSize(newSize);
                setVendorPage(1);
              }}
            />
          </div>
        </Card>
      )}

    </div>
  );
}

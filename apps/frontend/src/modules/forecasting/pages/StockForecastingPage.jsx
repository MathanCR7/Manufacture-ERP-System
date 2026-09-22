import React, { useState, useMemo } from 'react';
import {
  Package, AlertTriangle, Layers, Clock, TrendingUp,
  ShieldAlert, Search, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function StockForecastingPage() {
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

  // Filter States
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('ALL');

  // Table Pagination States
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(10);

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    if (!forecastData?.inventoryStockForecast) return [];
    return forecastData.inventoryStockForecast.filter(item => {
      const matchesSearch = item.skuName?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        item.skuCode?.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchesStatus = inventoryStatusFilter === 'ALL' || item.stockStatus === inventoryStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [forecastData, inventorySearch, inventoryStatusFilter]);

  // Paginated inventory slice
  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return filteredInventory.slice(start, start + inventoryPageSize);
  }, [filteredInventory, inventoryPage, inventoryPageSize]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="Stock & Reorder Point Forecasting"
        subtitle="Dynamic safety stock computation, inventory runway, and automated replenishment triggers"
        icon={Package}
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
              <span>Catalog Monitored</span>
              <Package className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {(forecastData?.inventoryStockForecast || []).length} SKUs
            </div>
            <div className="text-[11px] text-slate-500">
              Active finished products in ERP
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Imminent Stockouts</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {(forecastData?.inventoryStockForecast || []).filter(i => i.stockStatus === 'Stockout Imminent').length} SKUs
            </div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Depleting ≤ lead time
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Below Reorder Point</span>
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {(forecastData?.inventoryStockForecast || []).filter(i => i.stockStatus === 'Low Stock').length} SKUs
            </div>
            <div className="text-[11px] text-slate-500">
              Reorder trigger point reached
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Avg Inventory Cover</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {(() => {
                const list = (forecastData?.inventoryStockForecast || []).filter(i => i.dailyVelocity > 0);
                return list.length > 0 ? (list.reduce((s, i) => s + i.daysOfInventoryRemaining, 0) / list.length).toFixed(1) : '0';
              })()} Days
            </div>
            <div className="text-[11px] text-slate-500">
              Average remaining stock runway
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Reorder Units Needed</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {(forecastData?.inventoryStockForecast || []).reduce((s, i) => s + Number(i.recommendedReorderQuantity || 0), 0).toLocaleString()} Units
            </div>
            <div className="text-[11px] text-slate-500">
              Calculated safety replenishment
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MAIN DATA TABLE */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calculating Stock & Reorder Forecasting Models...</p>
          <p className="text-xs text-slate-500 mt-1">Analyzing consumption velocity, vendor lead times, and safety thresholds...</p>
        </Card>
      ) : (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" />
                Finished Good Stock & Reorder Points (ROP)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search SKU or name..."
                  value={inventorySearch}
                  onChange={e => {
                    setInventorySearch(e.target.value);
                    setInventoryPage(1);
                  }}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={inventoryStatusFilter}
                onChange={e => {
                  setInventoryStatusFilter(e.target.value);
                  setInventoryPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Stockout Imminent">Stockout Imminent</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Balanced">Balanced</option>
                <option value="Overstocked">Overstocked</option>
              </select>
            </div>
          </div>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU / Product</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold text-right">Current Stock</th>
                  <th className="py-3 px-4 font-semibold text-right">Daily Velocity</th>
                  <th className="py-3 px-4 font-semibold text-right">Safety Stock (SS)</th>
                  <th className="py-3 px-4 font-semibold text-right">Reorder Point (ROP)</th>
                  <th className="py-3 px-4 font-semibold text-right">Days Left</th>
                  <th className="py-3 px-4 font-semibold">Health Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Recommended Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedInventory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No products matched your search or status filter.
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map(item => (
                    <tr key={item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        <div>{item.skuName}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{item.skuCode}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.categoryName}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                        {item.dailyVelocity} / day
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                        {item.safetyStockRecommended} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                        {item.reorderPointCalculated} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {item.daysOfInventoryRemaining >= 999 ? '∞' : `${item.daysOfInventoryRemaining}d`}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.stockStatus === 'Stockout Imminent'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : item.stockStatus === 'Low Stock'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : item.stockStatus === 'Overstocked'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {item.stockStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {item.recommendedReorderQuantity > 0 ? `${item.recommendedReorderQuantity} ${item.unit}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <Pagination
              currentPage={inventoryPage}
              totalPages={Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize))}
              totalRecords={filteredInventory.length}
              pageSize={inventoryPageSize}
              onPageChange={setInventoryPage}
              onPageSizeChange={(newSize) => {
                setInventoryPageSize(newSize);
                setInventoryPage(1);
              }}
            />
          </div>
        </Card>
      )}

    </div>
  );
}

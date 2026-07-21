import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { TrendingUp, RefreshCw, Layers, Plus, ShieldAlert, BadgeIndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '@/components/ui/Pagination';

export default function ForecastByProductPage() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await api.get('/forecasting/by-product');
      setForecasts(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  // Reset page when forecasts list is updated
  useEffect(() => {
    setCurrentPage(1);
  }, [forecasts]);

  // Summary calculation metrics
  const totalProducts = forecasts.length;
  const deficitProductsCount = forecasts.filter(f => f.status !== 'Sufficient').length;
  const totalShortfallVal = forecasts.reduce((acc, item) => acc + (Number(item.shortfallValue) || 0), 0);

  // Pagination calculations
  const totalPages = Math.ceil(forecasts.length / ITEMS_PER_PAGE);
  const paginatedForecasts = forecasts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      
      {/* Sleek Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-205 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-indigo-100 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 uppercase">
              Production Planning
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <TrendingUp className="w-5.5 h-5.5 text-indigo-600 dark:text-indigo-400" />
            Product Demand Forecast
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Finished good demand forecasts aggregated from active customer Quotations & Sales Orders.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchForecast} 
          disabled={loading}
          className="flex items-center gap-2 border-slate-202 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 h-9 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Aggregate KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <Card className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-850 shadow-xs rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-955/20 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Products Tracked</p>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">{totalProducts}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-855 shadow-xs rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-955/20 rounded-xl text-rose-600 dark:text-rose-455 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Products with Deficit</p>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">{deficitProductsCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-855 shadow-xs rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-955/20 rounded-xl text-emerald-650 dark:text-emerald-450 shrink-0">
              <BadgeIndianRupee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Shortfall Market Value</p>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">₹{totalShortfallVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-505" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 animate-pulse">Running live forecast metrics...</p>
        </div>
      ) : forecasts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xs p-16 text-center text-slate-400 dark:text-slate-500 text-xs">
          No active product demands in current customer orders.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">In Stock</th>
                  <th className="px-4 py-3 text-right">Active Demand Qty</th>
                  <th className="px-4 py-3 text-center">Sufficiency Status</th>
                  <th className="px-4 py-3 text-right">Deficit Shortage</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Shortfall Cost Value</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedForecasts.map(item => {
                  const toProduceQty = Math.ceil(item.deficit > 0 ? item.deficit : item.totalDemand);
                  
                  return (
                    <tr key={item.productId} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                      <td className="px-4 py-3">
                        <span className="block font-bold text-slate-800 dark:text-slate-200">{item.productName}</span>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{item.productCode}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-350">
                        {item.currentStock} <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-650 dark:text-indigo-400">
                        {item.totalDemand} <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-[9px] font-bold border ${
                          item.status === 'Sufficient'
                            ? 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-450 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20 animate-pulse'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-455">
                        {item.deficit > 0 ? `${(Number(item.deficit) || 0).toFixed(2)} ${item.unit}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                        ₹{(Number(item.salePrice) || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-855 dark:text-slate-200 font-mono">
                        ₹{(Number(item.shortfallValue) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-lg shadow-xs text-[10px] flex items-center gap-1 mx-auto cursor-pointer h-7 border-none"
                          onClick={() => navigate('/production/add', {
                            state: {
                              productId: item.productId,
                              quantity: toProduceQty
                            }
                          })}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Produce
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer info & Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, forecasts.length)} of {forecasts.length} entries
              </div>

              <div className="order-1 sm:order-2">
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>

              <div className="text-xs text-slate-404 font-medium order-3">
                Total entries: {forecasts.length} products
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

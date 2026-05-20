import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { TrendingUp, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForecastByProductPage() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <TrendingUp className="w-6 h-6 mr-2 text-indigo-600" />
            Forecast by Product
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Finished good demand forecasts aggregated from active Quotations & Sales Orders.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchForecast} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Running forecast aggregates...</div>
      ) : forecasts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm p-12 text-center text-slate-400">
          No active product demands in current customer orders.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Product Code</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4 text-right">In Stock</th>
                  <th className="px-6 py-4 text-right">Active Demand Qty</th>
                  <th className="px-6 py-4 text-center">Sufficiency Status</th>
                  <th className="px-6 py-4 text-right">Deficit Shortage</th>
                  <th className="px-6 py-4 text-right">Unit Price</th>
                  <th className="px-6 py-4 text-right">Shortfall Cost Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {forecasts.map(item => (
                  <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-white">
                      {item.productCode}
                    </td>
                    <td className="px-6 py-4 font-semibold text-indigo-650 dark:text-indigo-400">
                      {item.productName}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                      {item.currentStock} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600">
                      {item.totalDemand} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 text-2xs font-semibold rounded-full ${
                        item.status === 'Sufficient'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-rose-600">
                      {item.deficit > 0 ? `${(Number(item.deficit) || 0).toFixed(2)} ${item.unit}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      ₹{(Number(item.salePrice) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                      ₹{(Number(item.shortfallValue) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

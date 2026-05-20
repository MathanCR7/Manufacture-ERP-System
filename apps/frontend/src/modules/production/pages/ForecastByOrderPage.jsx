import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { TrendingUp, RefreshCw, AlertCircle, Info, Calculator, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

export default function ForecastByOrderPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  
  // Interactive Calculator State
  const [calcProductId, setCalcProductId] = useState('');
  const [calcOrderQty, setCalcOrderQty] = useState(0);
  const [calcCurrentStock, setCalcCurrentStock] = useState(0);
  const [calcMinStockLevel, setCalcMinStockLevel] = useState(0);

  const navigate = useNavigate();

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await api.get('/forecasting/by-order');
      const data = res.data || { orders: [], analysis: [] };
      setOrders(data.orders || []);
      setAnalysis(data.analysis || []);
      
      // Pre-fill calculator with the first product if available
      if (data.analysis && data.analysis.length > 0) {
        const first = data.analysis[0];
        setCalcProductId(first.productId);
        setCalcOrderQty(first.orderQtyNeeded);
        setCalcCurrentStock(first.currentStock);
        setCalcMinStockLevel(first.minLevel);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  // Handle calculator product change
  const handleCalcProductChange = (productId) => {
    setCalcProductId(productId);
    const prod = analysis.find(p => p.productId === productId);
    if (prod) {
      setCalcOrderQty(prod.orderQtyNeeded);
      setCalcCurrentStock(prod.currentStock);
      setCalcMinStockLevel(prod.minLevel);
    }
  };

  // Calculator outputs
  const toFulfill = Math.max(0, calcOrderQty - calcCurrentStock);
  const toRestore = Number(calcMinStockLevel) || 0;
  const totalToProduce = toFulfill + toRestore;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <TrendingUp className="w-6 h-6 mr-2 text-indigo-600" />
            Forecast by Order
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automated calculations mapping customer demand against stock levels.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchForecast} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* 12.1.1 Explanation Banner */}
      <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-805/40 rounded-2xl p-4 text-blue-800 dark:text-blue-300 flex items-start space-x-3 shadow-2xs">
        <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm">
          <span className="font-bold">Demand Forecast by Order</span> — Undelivered orders are analyzed against current stock to determine production needs.
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Running forecast metrics...</div>
      ) : (
        <div className="space-y-8">
          {/* 12.1.2 Open Orders vs. Stock Analysis Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700/50">
              <h3 className="font-bold text-slate-850 dark:text-white text-base">Open Orders vs. Stock Analysis</h3>
              <p className="text-xs text-slate-450 mt-1">Grouped view of aggregated active product demands.</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4 text-center">Pending Orders</th>
                    <th className="px-6 py-4 text-right">Order Qty Needed</th>
                    <th className="px-6 py-4 text-right">Current Stock</th>
                    <th className="px-6 py-4 text-right">Stock Level Target</th>
                    <th className="px-6 py-4 text-center">Shortage</th>
                    <th className="px-6 py-4 text-right">Need to Produce</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {analysis.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400">No active product demands.</td>
                    </tr>
                  ) : (
                    analysis.map(item => (
                      <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-indigo-650 dark:text-indigo-400">
                          <span className="block font-bold text-slate-800 dark:text-white">{item.productName}</span>
                          <span className="text-3xs font-mono text-slate-450">{item.productCode}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {item.pendingOrdersCount}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-850 dark:text-white">
                          {(item.orderQtyNeeded || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-600 dark:text-slate-350">
                          {(item.currentStock || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-650 dark:text-slate-355">
                          {(item.minLevel || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.shortage < 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                              Shortfall: {Math.abs(item.shortage).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                              No shortage
                            </span>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-black ${item.needToProduce > 0 ? 'text-rose-650 text-sm' : 'text-emerald-600'}`}>
                          {(item.needToProduce || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3.5 rounded-xl shadow-xs text-xs flex items-center gap-1 mx-auto"
                            onClick={() => navigate('/production/add', {
                              state: {
                                productId: item.productId,
                                quantity: item.needToProduce,
                                orderId: item.orderId
                              }
                            })}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Produce
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 12.1.3 Production Need Calculator (Interactive) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-105 dark:border-slate-700 rounded-2xl shadow-xs p-6 space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center text-base">
                  <Calculator className="w-5 h-5 mr-1.5 text-indigo-500" />
                  Production Need Calculator
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">Tweak variables to analyze potential production runs.</p>
              </div>

              {/* Amber info box */}
              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 p-4 rounded-xl text-amber-800 dark:text-amber-300 text-xs space-y-2">
                <div className="font-bold flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1 text-amber-600" />
                  Calculation Formula
                </div>
                <div className="font-mono text-3xs p-2 bg-amber-100/50 dark:bg-amber-950/40 rounded-lg">
                  Formula: (Order Qty − Current Stock) + Min Stock Level = Total Production Needed
                </div>
                <div className="text-3xs leading-relaxed text-amber-700 dark:text-amber-400">
                  Example: Orders pending: 150 kg | Current stock: 50 kg | Min stock level: 20 kg <br />
                  - To fulfill orders: 150 − 50 = 100 kg needed <br />
                  - To restore stock level: 100 + 20 = 120 kg total to produce
                </div>
              </div>

              {/* Interactive inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-3xs font-bold text-slate-450 uppercase tracking-wider">Product</label>
                  <select
                    value={calcProductId}
                    onChange={(e) => handleCalcProductChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="">Select a product to inspect...</option>
                    {analysis.map(p => (
                      <option key={p.productId} value={p.productId}>{p.productName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-3xs font-bold text-slate-450 uppercase tracking-wider">Order Qty Needed</label>
                  <Input
                    type="number"
                    min="0"
                    value={calcOrderQty}
                    onChange={(e) => setCalcOrderQty(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-3xs font-bold text-slate-450 uppercase tracking-wider">Current Stock</label>
                  <Input
                    type="number"
                    min="0"
                    value={calcCurrentStock}
                    onChange={(e) => setCalcCurrentStock(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-3xs font-bold text-slate-450 uppercase tracking-wider">Min Stock Level Target</label>
                  <Input
                    type="number"
                    min="0"
                    value={calcMinStockLevel}
                    onChange={(e) => setCalcMinStockLevel(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>
            </div>

            {/* Live output panel (green bg) */}
            <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 p-6 rounded-2xl shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <h4 className="font-bold text-emerald-850 dark:text-emerald-400 text-sm uppercase tracking-wider">Live Estimation Summary</h4>
                <p className="text-3xs text-emerald-600 dark:text-emerald-500/80 mt-0.5">Calculated production outputs.</p>
              </div>

              <div className="space-y-4 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center py-2 border-b border-emerald-100/50 dark:border-emerald-900/20">
                  <span className="text-2xs text-slate-600 dark:text-emerald-400">To Fulfill Orders:</span>
                  <span className="font-bold text-blue-600 text-base">{toFulfill.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-emerald-100/50 dark:border-emerald-900/20">
                  <span className="text-2xs text-slate-600 dark:text-emerald-400">To Restore Stock Level:</span>
                  <span className="font-bold text-amber-600 text-base">{toRestore.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center py-3 bg-emerald-100/35 dark:bg-emerald-900/10 px-3 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">Total to Produce:</span>
                  <span className="font-black text-purple-650 text-xl">{totalToProduce.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <Button
                disabled={!calcProductId}
                onClick={() => navigate('/production/add', {
                  state: {
                    productId: calcProductId,
                    quantity: totalToProduce
                  }
                })}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs uppercase"
              >
                Schedule Production run
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

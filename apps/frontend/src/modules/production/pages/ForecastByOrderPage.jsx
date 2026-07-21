import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { 
  TrendingUp, RefreshCw, AlertCircle, Info, Calculator, Plus, 
  ArrowRight, Minus, Equal, Layers, Shield, ShoppingBag, Boxes,
  Flame, CheckCircle2, ChevronRight, Activity, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '@/components/ui/Pagination';

export default function ForecastByOrderPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  
  // Interactive Calculator State
  const [calcProductId, setCalcProductId] = useState('');
  const [calcOrderQty, setCalcOrderQty] = useState(0);
  const [calcCurrentStock, setCalcCurrentStock] = useState(0);
  const [calcMinStockLevel, setCalcMinStockLevel] = useState(0);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  // Reset page on analysis data change
  useEffect(() => {
    setCurrentPage(1);
  }, [analysis]);

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

  // Pagination calculations
  const totalPages = Math.ceil(analysis.length / ITEMS_PER_PAGE);
  const paginatedAnalysis = analysis.slice(
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
            Demand Forecasting
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Real-time calculation mapping pending customer orders against available warehouse stock.
          </p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={fetchForecast} 
          disabled={loading}
          className="flex items-center gap-2 border-slate-202 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 h-9 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recalculate Bounds
        </Button>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 animate-pulse">Running live forecast metrics...</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Interactive Calculator Block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Variables Panel */}
            <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between rounded-2xl">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-500" />
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-50">Interactive Demand Planner</CardTitle>
                </div>
                <CardDescription className="text-xs">Adjust calculations for any finished product in real-time.</CardDescription>
              </CardHeader>
              
              <CardContent className="p-4 space-y-4">
                
                {/* Visual Math Flow Diagram */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Formula Flowchart
                  </span>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Step 1: Demand */}
                    <div className="flex-1 min-w-[120px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                      <div className="text-slate-400 dark:text-slate-500 font-semibold text-[8px] uppercase">1. Order Demand</div>
                      <div className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{calcOrderQty.toLocaleString('en-IN')}</div>
                      <div className="text-[8px] text-slate-400 truncate">Units needed</div>
                    </div>
                    
                    <Minus className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    
                    {/* Step 2: Available Stock */}
                    <div className="flex-1 min-w-[120px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                      <div className="text-slate-400 dark:text-slate-500 font-semibold text-[8px] uppercase">2. Current Stock</div>
                      <div className="text-base font-black text-slate-700 dark:text-slate-300 mt-0.5">{calcCurrentStock.toLocaleString('en-IN')}</div>
                      <div className="text-[8px] text-slate-400 truncate">Units on hand</div>
                    </div>
                    
                    <Plus className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    
                    {/* Step 3: Safety Targets */}
                    <div className="flex-1 min-w-[120px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                      <div className="text-slate-400 dark:text-slate-500 font-semibold text-[8px] uppercase">3. Target Safety</div>
                      <div className="text-base font-black text-amber-600 dark:text-amber-500 mt-0.5">{toRestore.toLocaleString('en-IN')}</div>
                      <div className="text-[8px] text-slate-400 truncate">Minimum stock level</div>
                    </div>
                    
                    <Equal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    
                    {/* Step 4: Net production */}
                    <div className="flex-1 min-w-[120px] bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 p-2.5 rounded-xl shadow-xs">
                      <div className="text-violet-600 dark:text-violet-400 font-bold text-[8px] uppercase">4. RUN TOTAL</div>
                      <div className="text-base font-black text-violet-700 dark:text-violet-300 mt-0.5">{totalToProduce.toLocaleString('en-IN')}</div>
                      <div className="text-[8px] text-slate-400 truncate">Total to produce</div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product Filter</label>
                    <select
                      value={calcProductId}
                      onChange={(e) => handleCalcProductChange(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold h-9"
                    >
                      <option value="">Select a product...</option>
                      {analysis.map(p => (
                        <option key={p.productId} value={p.productId}>{p.productName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order Qty Demand</label>
                    <Input
                      type="number"
                      min="0"
                      value={calcOrderQty}
                      onChange={(e) => setCalcOrderQty(Math.max(0, Number(e.target.value)))}
                      className="bg-slate-50 dark:bg-slate-900 rounded-xl border-slate-200 h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Stock</label>
                    <Input
                      type="number"
                      min="0"
                      value={calcCurrentStock}
                      onChange={(e) => setCalcCurrentStock(Math.max(0, Number(e.target.value)))}
                      className="bg-slate-50 dark:bg-slate-900 rounded-xl border-slate-200 h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Safety Stock Level</label>
                    <Input
                      type="number"
                      min="0"
                      value={calcMinStockLevel}
                      onChange={(e) => setCalcMinStockLevel(Math.max(0, Number(e.target.value)))}
                      className="bg-slate-50 dark:bg-slate-900 rounded-xl border-slate-200 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Sleek Dynamic Calculation Detail */}
                <div className="bg-amber-500/5 dark:bg-slate-900/35 p-3 rounded-xl border border-amber-500/10 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Live Calculation Detail
                  </div>
                  <div className="font-semibold text-slate-700 dark:text-slate-350 text-[11px]">
                    Active Product: {analysis.find(p => p.productId === calcProductId)?.productName || 'No Product Selected'}
                  </div>
                  <div className="space-y-1 font-mono text-[9px] text-slate-505 dark:text-slate-455 bg-white/40 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850">
                    <div>1. Fulfill Orders: {calcOrderQty.toLocaleString('en-IN')} (Pending Demand) − {calcCurrentStock.toLocaleString('en-IN')} (Warehouse Stock) = <span className="font-bold text-indigo-600 dark:text-indigo-400">{toFulfill.toLocaleString('en-IN')} needed</span></div>
                    <div>2. Restore Safety: {toFulfill.toLocaleString('en-IN')} (Shortfall) + {toRestore.toLocaleString('en-IN')} (Min Stock Target) = <span className="font-bold text-emerald-600 dark:text-emerald-450">{totalToProduce.toLocaleString('en-IN')} total to produce</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Estimation Output Card */}
            <div className="bg-emerald-500/5 dark:bg-slate-900 border border-emerald-500/10 dark:border-slate-800 p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-emerald-900 dark:text-emerald-400 pointer-events-none">
                <Calculator size={120} />
              </div>
              
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-emerald-100 dark:bg-emerald-950/40 text-emerald-805 dark:text-emerald-400 uppercase">
                  Planning Output
                </span>
                <h4 className="font-bold text-emerald-900 dark:text-emerald-400 text-base mt-2">Live Summary</h4>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-505 mt-0.5">Calculated production outputs.</p>
              </div>

              <div className="space-y-3 flex-1 flex flex-col justify-center text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-emerald-100/50 dark:border-emerald-900/20">
                  <span className="font-semibold text-slate-555 dark:text-slate-400">Order Shortfall:</span>
                  <span className="font-extrabold text-blue-650 dark:text-blue-400 text-base">{toFulfill.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-emerald-100/50 dark:border-emerald-900/20">
                  <span className="font-semibold text-slate-555 dark:text-slate-400">Safety Buffer:</span>
                  <span className="font-extrabold text-amber-600 dark:text-amber-500 text-base">{toRestore.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center py-2.5 bg-emerald-100/20 dark:bg-emerald-900/20 px-3.5 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                  <span className="font-bold text-emerald-950 dark:text-emerald-305 text-xs">Total Production Run:</span>
                  <span className="font-black text-indigo-705 dark:text-indigo-400 text-xl">{totalToProduce.toLocaleString('en-IN')}</span>
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
                className="w-full bg-emerald-650 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-sm text-[10px] uppercase transition-all cursor-pointer h-9"
              >
                Schedule Production Run
              </Button>
            </div>
          </div>

          {/* Detailed Stock Analysis Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-205 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">Active Demand Analysis</h3>
              <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">Aggregated product quantities mapped from current warehouse inventory.</p>
            </div>
            
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Finished Product</th>
                    <th className="px-4 py-3 text-center">Active Orders</th>
                    <th className="px-4 py-3 text-right">Pending Demand</th>
                    <th className="px-4 py-3 text-right">Available Stock</th>
                    <th className="px-4 py-3 text-right">Min Target</th>
                    <th className="px-4 py-3 text-center">Deficit</th>
                    <th className="px-4 py-3 text-right">Required Run</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedAnalysis.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">No active product demands.</td>
                    </tr>
                  ) : (
                    paginatedAnalysis.map(item => {
                      const percentageStock = item.minLevel > 0 ? ((item.currentStock / item.minLevel) * 100).toFixed(0) : 100;
                      
                      return (
                        <tr key={item.productId} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                          <td className="px-4 py-3">
                            <span className="block font-bold text-slate-800 dark:text-slate-200">{item.productName}</span>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{item.productCode}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-350">
                            {item.pendingOrdersCount}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-855 dark:text-slate-150">
                            {(item.orderQtyNeeded || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">
                            {(item.currentStock || 0).toLocaleString('en-IN')}
                            <span className="block text-[9px] text-slate-400 font-medium">({percentageStock}% target)</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-500 dark:text-slate-455">
                            {(item.minLevel || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.shortage < 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20">
                                Shortfall: {Math.abs(item.shortage).toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-bold bg-emerald-500/10 text-emerald-650 dark:text-emerald-450 border border-emerald-500/20">
                                Safe Surplus
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right font-extrabold ${item.needToProduce > 0 ? 'text-rose-605 dark:text-rose-400' : 'text-emerald-600'}`}>
                            {(item.needToProduce || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-lg shadow-xs text-[10px] flex items-center gap-1 mx-auto cursor-pointer h-7"
                              onClick={() => navigate('/production/add', {
                                state: {
                                  productId: item.productId,
                                  quantity: item.needToProduce,
                                  orderId: item.orderId
                                }
                              })}
                            >
                              <Plus className="w-3 h-3" />
                              Produce
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, analysis.length)} of {analysis.length} entries
                </div>

                <div className="order-1 sm:order-2">
                  <Pagination 
                    currentPage={currentPage} 
                    totalPages={totalPages} 
                    onPageChange={setCurrentPage} 
                  />
                </div>

                <div className="text-xs text-slate-404 font-medium order-3">
                  Total entries: {analysis.length} products
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

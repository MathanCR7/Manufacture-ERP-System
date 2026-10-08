import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  Layers, Package, AlertTriangle, ArrowRight, RefreshCw,
  Search, Clock, CheckCircle2, ChevronRight, ExternalLink,
  Calendar, Factory, Sparkles, Filter
} from 'lucide-react';

export default function ProductionRequirementPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch live aggregated demand and shortfalls from open Standard Orders
  const { data: requirements = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['production-requirements'],
    queryFn: async () => {
      const res = await api.get('/orders/production-requirements');
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 30000
  });

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set();
    requirements.forEach(r => { if (r.category) set.add(r.category); });
    return ['All', ...Array.from(set)];
  }, [requirements]);

  // Filtered requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter(r => {
      const matchCat = selectedCategory === 'All' || r.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        r.productName?.toLowerCase().includes(q) ||
        r.productCode?.toLowerCase().includes(q) ||
        r.ordersInvolved?.some(o => o.docNo?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [requirements, selectedCategory, searchQuery]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalProducts = requirements.length;
    const totalShortfall = requirements.reduce((s, r) => s + Number(r.totalShortfall || 0), 0);
    const totalInProduction = requirements.reduce((s, r) => s + Number(r.inProduction || 0), 0);
    const totalNetToProduce = requirements.reduce((s, r) => s + Number(r.netToProduce || 0), 0);
    return { totalProducts, totalShortfall, totalInProduction, totalNetToProduce };
  }, [requirements]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Production Requirement Hub</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              Back-Order Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aggregated deficits across open Standard Orders. Shortages drive manufacturing production to fulfill customer delivery commitments.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>{isRefetching ? 'Syncing...' : 'Refresh Demand'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales/order')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Sales Order Desk</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 my-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            <span>Items with Shortage</span>
          </div>
          <div className="text-2xl font-black mt-1 text-slate-800 dark:text-slate-100">
            {metrics.totalProducts}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Distinct finished goods demanded
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Total Customer Shortfall</span>
          </div>
          <div className="text-2xl font-black mt-1 text-rose-600 dark:text-rose-400">
            -{metrics.totalShortfall.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Total units waiting for production
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Factory className="w-3.5 h-3.5 text-amber-500" />
            <span>Currently In Production</span>
          </div>
          <div className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400">
            {metrics.totalInProduction.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Units actively in manufacturing batches
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs bg-gradient-to-br from-amber-50/50 to-emerald-50/30 dark:from-amber-950/20 dark:to-emerald-950/10">
          <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Net Output to Produce</span>
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
            {metrics.totalNetToProduce.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Shortfall minus active WIP
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs mb-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name, code, or order #..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* REQUIREMENTS DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10.5px]">
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Customer Shortfall</th>
                <th className="py-2.5 px-3 text-right">In Production (WIP)</th>
                <th className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400">Net to Produce</th>
                <th className="py-2.5 px-3">Earliest Due Date</th>
                <th className="py-2.5 px-3">Orders Involved</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Aggregating demand from open customer orders...</span>
                  </td>
                </tr>
              ) : filteredRequirements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                    <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">No Pending Shortages</div>
                    <div className="text-xs text-slate-500 mt-0.5">All customer orders have sufficient warehouse stock reserved.</div>
                  </td>
                </tr>
              ) : (
                filteredRequirements.map(item => (
                  <tr key={item.productId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Product */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{item.productName}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{item.productCode}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                        {item.category}
                      </span>
                    </td>

                    {/* Total Shortfall */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900">
                        -{item.totalShortfall} {item.unit}
                      </span>
                    </td>

                    {/* In Production */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {item.inProduction > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          {item.inProduction} {item.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Net to Produce */}
                    <td className="py-3 px-3 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                      {item.netToProduce > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
                          {item.netToProduce} {item.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">Fully Covered</span>
                      )}
                    </td>

                    {/* Earliest Delivery Date */}
                    <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(item.earliestDeliveryDate).toLocaleDateString('en-GB')}</span>
                      </div>
                    </td>

                    {/* Orders Involved */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {item.ordersInvolved?.map((ord, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => navigate(`/sales/order?edit=${ord.orderId}&from=/production/requirements`)}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-950/60 border border-slate-200 dark:border-slate-700 rounded text-[10.5px] font-mono font-bold text-slate-700 hover:text-amber-800 dark:text-slate-300 dark:hover:text-amber-200 cursor-pointer transition-colors"
                            title={`${ord.customerName} • Short: -${ord.shortfall}`}
                          >
                            {ord.docNo}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const targetQty = item.netToProduce > 0 ? item.netToProduce : item.totalShortfall;
                          navigate(`/production/add?productId=${item.productId}&quantity=${targetQty}`, {
                            state: {
                              productId: item.productId,
                              quantity: targetQty,
                              targetOrderId: item.ordersInvolved?.[0]?.orderId
                            }
                          });
                        }}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md shadow-xs inline-flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                      >
                        <Factory className="w-3 h-3" />
                        <span>Plan Batch</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

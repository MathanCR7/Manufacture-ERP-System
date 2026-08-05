import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, RefreshCw, Download, Search, Calendar, IndianRupee,
  TrendingUp, Package, Clock, ArrowUpDown, ChevronDown, Layers, Eye,
  Sparkles, CheckCircle2, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const COLUMNS = [
  { key: 'Quotation',             label: 'Quotation',              color: 'blue' },
  { key: 'Waiting For Confirmation',label: 'Awaiting Confirm',    color: 'violet' },
  { key: 'Waiting For Production', label: 'Waiting Production',   color: 'slate' },
  { key: 'In Production',          label: 'In Production',        color: 'amber' },
  { key: 'Ready For Shipment',     label: 'Ready to Ship',        color: 'teal' },
];

const COLOR_MAP = {
  blue: { 
    header: 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40', 
    badge: 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm shadow-blue-500/20', 
    text: 'text-blue-600 dark:text-blue-400', 
    dot: 'bg-blue-500 dark:bg-blue-400 shadow-blue-500/30 shadow-lg', 
    card_border: 'border-blue-100 dark:border-blue-900/40 hover:border-blue-300 dark:hover:border-blue-700', 
    glow: 'shadow-blue-500/5 dark:shadow-blue-500/10 hover:shadow-blue-500/20' 
  },
  violet: { 
    header: 'bg-violet-50/80 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/40', 
    badge: 'bg-violet-600 dark:bg-violet-500 text-white shadow-sm shadow-violet-500/20', 
    text: 'text-violet-600 dark:text-violet-400', 
    dot: 'bg-violet-500 dark:bg-violet-400 shadow-violet-500/30 shadow-lg', 
    card_border: 'border-violet-100 dark:border-violet-900/40 hover:border-violet-300 dark:hover:border-violet-700', 
    glow: 'shadow-violet-500/5 dark:shadow-violet-500/10 hover:shadow-violet-500/20' 
  },
  slate: { 
    header: 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50', 
    badge: 'bg-slate-600 dark:bg-slate-500 text-white shadow-sm shadow-slate-500/20', 
    text: 'text-slate-700 dark:text-slate-300', 
    dot: 'bg-slate-500 dark:bg-slate-400 shadow-slate-500/30 shadow-lg', 
    card_border: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700', 
    glow: 'shadow-slate-500/5 dark:shadow-slate-500/10 hover:shadow-slate-500/20' 
  },
  amber: { 
    header: 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40', 
    badge: 'bg-amber-600 dark:bg-amber-500 text-white shadow-sm shadow-amber-500/20', 
    text: 'text-amber-700 dark:text-amber-400', 
    dot: 'bg-amber-500 dark:bg-amber-400 shadow-amber-500/30 shadow-lg', 
    card_border: 'border-amber-100 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700', 
    glow: 'shadow-amber-500/5 dark:shadow-amber-500/10 hover:shadow-amber-500/20' 
  },
  teal: { 
    header: 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/40', 
    badge: 'bg-teal-600 dark:bg-teal-500 text-white shadow-sm shadow-teal-500/20', 
    text: 'text-teal-600 dark:text-teal-400', 
    dot: 'bg-teal-500 dark:bg-teal-400 shadow-teal-500/30 shadow-lg', 
    card_border: 'border-teal-100 dark:border-teal-900/40 hover:border-teal-300 dark:hover:border-teal-700', 
    glow: 'shadow-teal-500/5 dark:shadow-teal-500/10 hover:shadow-teal-500/20' 
  },
};

export default function OrderStatusPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState(null);

  const fetchKanban = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/status/kanban');
      // Sort each column: most recent first
      const sorted = {};
      Object.keys(res.data || {}).forEach(col => {
        sorted[col] = [...(res.data[col] || [])].sort(
          (a, b) => new Date(b.deliveryDate) - new Date(a.deliveryDate)
        );
      });
      setData(sorted);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchKanban(); 
  }, []);

  const handleExport = () => {
    const headers = ['Column','Order Ref','Customer','Products','Total','Profit','Delivery'];
    const rows = [];
    COLUMNS.forEach(col => {
      (data[col.key] || []).forEach(o => {
        rows.push([
          col.label, o.referenceNo, o.customerName,
          (o.products || []).join('; '), o.total, o.profit,
          new Date(o.deliveryDate).toLocaleDateString('en-GB')
        ]);
      });
    });
    if (!rows.length) return;
    const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `kanban_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  const getFiltered = (colKey) => {
    const list = data[colKey] || [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(o =>
      o.referenceNo?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q)
    );
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2.5">
            <LayoutGrid className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Order Status Board
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Real-time track and manage pipeline stages from quotation receipt to shipment release.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all shadow-xs h-9.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Export Pipeline
          </button>
          <button 
            onClick={fetchKanban} 
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition-all h-9.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pipeline Stages Counters Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        {COLUMNS.map(col => {
          const c = COLOR_MAP[col.color];
          const count = data[col.key]?.length || 0;
          return (
            <div key={col.key} className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 ${c.card_border}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400">{col.label}</span>
                </div>
              </div>
              <p className={`text-2xl font-black tracking-tight ${c.text}`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Search Filter Panel */}
      <div className="relative shadow-xs rounded-xl overflow-hidden">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Filter pipeline by order ID ref or customer name..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all h-10 font-medium" 
        />
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-xs font-semibold">Loading orders pipeline...</span>
        </div>
      ) : (
        /* Kanban Columns Grid */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-start pb-6">
          {COLUMNS.map(col => {
            const c = COLOR_MAP[col.color];
            const items = getFiltered(col.key);
            const totalAmt = items.reduce((s, o) => s + Number(o.total || 0), 0);

            return (
              <div key={col.key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xs">
                {/* Column Header */}
                <div className={`px-3 py-2.5 border-b border-slate-200 dark:border-slate-800/80 ${c.header} border flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{col.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${c.badge}`}>
                    {items.length}
                  </span>
                </div>

                {/* Total Value Summary Row */}
                {items.length > 0 && (
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-extrabold">Value</span>
                    <span className={`text-xs font-black ${c.text}`}>
                      ₹{totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                {/* Cards Column List */}
                <div className="flex flex-col gap-3 p-3 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 gap-2">
                      <Package className="w-8 h-8 opacity-30" />
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">No active orders</span>
                    </div>
                  ) : (
                    items.map(order => {
                      const profit = Number(order.profit || 0);
                      const isExpanded = expandedCard === order.id;
                      return (
                        <div 
                          key={order.id}
                          className={`bg-white dark:bg-slate-900 border ${c.card_border} rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${c.glow} cursor-pointer relative shadow-sm`}
                          onClick={() => setExpandedCard(isExpanded ? null : order.id)}
                        >
                          {/* Card Content Top */}
                          <div className="p-3.5 space-y-2.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className={`font-mono text-[9px] font-extrabold ${c.text} bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-2 py-0.5 rounded-md`}>
                                #{order.referenceNo}
                              </span>
                              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(`/orders/list?id=${order.id}&from=status`);
                                  }}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                  title="View Order Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <ChevronDown 
                                  className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 cursor-pointer ${isExpanded ? 'rotate-180' : ''}`} 
                                  onClick={() => setExpandedCard(isExpanded ? null : order.id)}
                                />
                              </div>
                            </div>
                            
                            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 leading-tight text-xs tracking-tight line-clamp-2">
                              {order.customerName}
                            </h4>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="text-slate-400 dark:text-slate-500 block uppercase font-bold text-[8px]">Subtotal</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 font-mono">
                                  ₹{Number(order.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 dark:text-slate-500 block uppercase font-bold text-[8px]">Profit</span>
                                <span className={`text-[10px] font-extrabold font-mono ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {profit >= 0 ? '+' : ''}₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 space-y-3 text-[10px]"
                              >
                                {(order.products || []).length > 0 && (
                                  <div>
                                    <p className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 font-bold">Ordered Products</p>
                                    <ul className="space-y-1">
                                      {order.products.map((p, i) => (
                                        <li key={i} className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium leading-relaxed">
                                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
                                          <span className="truncate">{p}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                  <div>
                                    <p className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-bold">Raw Mat. Cost</p>
                                    <p className="font-extrabold text-slate-700 dark:text-slate-200 font-mono">₹{Number(order.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-bold">Delivery Date</p>
                                    <p className="font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                      {new Date(order.deliveryDate).toLocaleDateString('en-GB')}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

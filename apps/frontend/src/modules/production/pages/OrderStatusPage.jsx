import React, { useState, useEffect } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, RefreshCw, Download, Search, Calendar, IndianRupee,
  TrendingUp, Package, Clock, ArrowUpDown, ChevronDown, Layers, Eye
} from 'lucide-react';

const COLUMNS = [
  { key: 'Quotation',             label: 'Quotation',              color: 'blue' },
  { key: 'Waiting For Confirmation',label: 'Awaiting Confirm',    color: 'violet' },
  { key: 'Waiting For Production', label: 'Waiting Production',   color: 'slate' },
  { key: 'In Production',          label: 'In Production',        color: 'amber' },
  { key: 'Ready For Shipment',     label: 'Ready to Ship',        color: 'teal' },
];

const COLOR_MAP = {
  blue:   { header: 'bg-blue-50 dark:bg-blue-500/20 border-blue-100 dark:border-blue-500/30', badge: 'bg-blue-600 dark:bg-blue-500 text-white', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500 dark:bg-blue-400', card_border: 'border-blue-100 dark:border-blue-500/20', glow: 'shadow-blue-500/5 dark:shadow-blue-500/10' },
  violet: { header: 'bg-violet-50 dark:bg-violet-500/20 border-violet-100 dark:border-violet-500/30', badge: 'bg-violet-600 dark:bg-violet-500 text-white', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500 dark:bg-violet-400', card_border: 'border-violet-100 dark:border-violet-500/20', glow: 'shadow-violet-500/5 dark:shadow-violet-500/10' },
  slate:  { header: 'bg-slate-100 dark:bg-slate-600/20 border-slate-200 dark:border-slate-600/30', badge: 'bg-slate-600 text-white', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-500 dark:bg-slate-400', card_border: 'border-slate-200 dark:border-slate-600/20', glow: 'shadow-slate-500/5 dark:shadow-slate-500/10' },
  amber:  { header: 'bg-amber-50 dark:bg-amber-500/20 border-amber-100 dark:border-amber-500/30', badge: 'bg-amber-600 dark:bg-amber-500 text-white', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500 dark:bg-amber-400', card_border: 'border-amber-100 dark:border-amber-500/20', glow: 'shadow-amber-500/5 dark:shadow-amber-500/10' },
  teal:   { header: 'bg-teal-50 dark:bg-teal-500/20 border-teal-100 dark:border-teal-500/30', badge: 'bg-teal-600 dark:bg-teal-500 text-white', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500 dark:bg-teal-400', card_border: 'border-teal-100 dark:border-teal-500/20', glow: 'shadow-teal-500/5 dark:shadow-teal-500/10' },
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchKanban(); }, []);

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
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const totalOrders = COLUMNS.reduce((s, c) => s + (data[c.key]?.length || 0), 0);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-55 via-white to-slate-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 flex flex-col text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/20 border border-violet-100 dark:border-violet-500/30 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Order Status Board</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm pl-1">Visual pipeline from Quotation to Shipment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-all">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={fetchKanban} disabled={loading}
            className="p-2.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {COLUMNS.map(col => {
          const c = COLOR_MAP[col.color];
          const count = data[col.key]?.length || 0;
          return (
            <div key={col.key} className={`bg-white dark:bg-slate-800/60 border rounded-xl p-3 ${c.card_border}`}>
              <div className={`flex items-center gap-1.5 mb-1`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{col.label}</span>
              </div>
              <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by order ID or customer name..."
          className="w-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
          <span>Loading pipeline...</span>
        </div>
      ) : (
        /* Kanban Columns */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {COLUMNS.map(col => {
            const c = COLOR_MAP[col.color];
            const items = getFiltered(col.key);
            const totalAmt = items.reduce((s, o) => s + Number(o.total || 0), 0);

            return (
              <div key={col.key} className="bg-white/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl flex flex-col overflow-hidden">
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 ${c.header} border flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">{col.label}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.badge}`}>
                    {items.length}
                  </span>
                </div>

                {/* Total Row */}
                {items.length > 0 && (
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/30 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Value</span>
                    <span className={`text-xs font-bold ${c.text}`}>
                      ₹{totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                {/* Cards */}
                <div className="flex flex-col gap-2.5 p-3 overflow-y-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600 gap-2">
                      <Package className="w-8 h-8 opacity-30" />
                      <span className="text-xs">No orders</span>
                    </div>
                  ) : items.map(order => {
                    const profit = Number(order.profit || 0);
                    const isExpanded = expandedCard === order.id;
                    return (
                      <div key={order.id}
                        className={`bg-white dark:bg-slate-900/80 border ${c.card_border} rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg ${c.glow} cursor-pointer`}
                        onClick={() => setExpandedCard(isExpanded ? null : order.id)}>
                        {/* Card Top */}
                        <div className="p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`font-mono text-[11px] font-bold ${c.text} bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-transparent`}>
                              #{order.referenceNo}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/orders/list', { state: { orderId: order.id } });
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{order.customerName}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              ₹{Number(order.total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                            <span className={`text-[10px] font-semibold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {profit >= 0 ? '+' : ''}₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-slate-150 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
                            {(order.products || []).length > 0 && (
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Products</p>
                                <ul className="space-y-0.5">
                                  {order.products.map((p, i) => (
                                    <li key={i} className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                      <span className={`w-1 h-1 rounded-full ${c.dot} flex-shrink-0`} />
                                      <span className="truncate">{p}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">Cost</p>
                                <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">₹{Number(order.cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">Delivery</p>
                                <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {new Date(order.deliveryDate).toLocaleDateString('en-GB')}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

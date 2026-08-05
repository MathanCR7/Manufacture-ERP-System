import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '@/components/ui/Pagination';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Package, AlertTriangle, TrendingUp, TrendingDown, Layers,
  RefreshCw, AlertCircle, Search
} from 'lucide-react';

const fmt = (n) => {
  const num = Number(n || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const TT = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
};

const STATUS = {
  OK: { dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950/30' },
  Low: { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/30', label: 'Low Stock' },
  Critical: { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-50 dark:bg-rose-955/30' },
  'Out of Stock': { dot: 'bg-red-700', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-50 dark:bg-red-955/30' },
};

function KPICard({ title, value, sub, icon: Icon, accent, loading, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-105 dark:border-slate-800 p-5 relative overflow-hidden transition-all duration-300 hover:shadow-md group ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-900/60 hover:bg-slate-50/20 dark:hover:bg-slate-950/20' : 'hover:-translate-y-0.5'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-405 dark:text-slate-500">{title}</span>
        <div className="p-2 rounded-xl group-hover:scale-110 transition-transform duration-300" style={{ background: accent + '22' }}>
          <Icon size={15} style={{ color: accent }} />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
        {loading ? <span className="inline-block h-7 w-24 bg-slate-100 dark:bg-slate-850 animate-pulse rounded-lg" /> : value}
      </div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

function Card({ title, accent = '#6366f1', children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function InventoryDashboardPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [tab, setTab]         = useState('rm');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage]       = useState(1);
  const itemsPerPage          = 10;

  const handleTabChange = (key) => {
    setTab(key);
    setSearchQuery('');
    setPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setPage(1);
  };

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { const r = await api.get('/dashboard/inventory'); setData(r.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { load(); }, []);
  const d = data || {};
  const s = d.summary || {};

  const TABS = [
    { key: 'rm',   label: '🧪 Raw Materials' },
    { key: 'fp',   label: '📦 Finished Goods' },
    { key: 'dead', label: '💤 Low & Dead Stock' },
  ];
  const tableData = tab === 'rm' ? (d.rmStockList || []) : tab === 'fp' ? (d.fpStockList || []) : (d.deadStock || []);

  const filteredTableData = tableData.filter(item => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      item.name?.toLowerCase().includes(term) ||
      item.code?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term) ||
      item.status?.toLowerCase().includes(term)
    );
  });

  const totalItems = filteredTableData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedData = filteredTableData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">



      {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard title="Total Inv. Value" value={fmt(s.totalInventoryValue)} sub={`RM: ${fmt(s.rmTotalValue)}`}   icon={Package}      accent="#3b82f6" loading={loading} onClick={() => navigate('/rm/stock?from=inventory')} />
        <KPICard title="FG Stock Value"   value={fmt(s.fpTotalValue)}        sub={`${s.totalFpItems || 0} prods`}  icon={Layers}       accent="#10b981" loading={loading} onClick={() => navigate('/products/stock?from=inventory')} />
        <KPICard title="Low Stock"        value={s.lowStockCount || 0}       sub="Below reorder level"              icon={AlertTriangle} accent="#f59e0b" loading={loading} onClick={() => navigate('/rm/stock/low?from=inventory')} />
        <KPICard title="Critical Items"   value={s.criticalCount || 0}       sub="Below minimum level"              icon={AlertCircle}  accent="#ef4444" loading={loading} onClick={() => navigate('/rm/stock/low?from=inventory')} />
        <KPICard title="Stock In (30d)"   value={`${s.stockInLast30 || 0}`}  sub="Units received"                  icon={TrendingUp}   accent="#6366f1" loading={loading} onClick={() => navigate('/grn/list?from=inventory')} />
        <KPICard title="Stock Out (30d)"  value={`${s.stockOutLast30 || 0}`} sub="Units dispatched"                icon={TrendingDown} accent="#ec4899" loading={loading} onClick={() => navigate('/sales/list?from=inventory')} />
      </div>

      {/* Movement Trend + Reorder Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card title="Stock Movement Trend (14 Days)" accent="#3b82f6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.movementTrend || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="in"  name="Stock In"  fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="out" name="Stock Out" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title="🚨 Reorder Alerts" accent="#ef4444">
          {(d.reorderAlerts || []).length === 0 && !loading
            ? <p className="text-xs text-emerald-500 text-center py-6">✅ All stock levels healthy</p>
            : (
              <div className="space-y-2">
                {(d.reorderAlerts || []).slice(0, 4).map(rm => {
                  const m = STATUS[rm.status] || STATUS.OK;
                  return (
                    <div key={rm.id} className="flex items-center gap-2 py-2 border-b border-slate-50 dark:border-slate-800/50">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-700 dark:text-slate-300 truncate">{rm.name}</div>
                        <div className="text-[10px] text-slate-400">Stock: {rm.currentStock} · Reorder Level: {rm.alertLevel}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.badge} ${m.text}`}>{m.label || rm.status}</span>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>
      </div>

      {/* Stock Table */}
      <Card title="Stock Inventory" accent="#6366f1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex gap-2 flex-wrap">
            {TABS.map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 border ${tab === t.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-indigo-900/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${tab === 'rm' ? 'raw materials' : tab === 'fp' ? 'finished goods' : 'low & dead stock'}...`}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition font-semibold text-slate-700 dark:text-slate-200"
            />
            {searchQuery && (
              <button 
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 hover:text-slate-655 dark:hover:text-slate-300 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {['Code','Name','Category','Stock','Alert','Price','Value','Status'].map(h => (
                  <th key={h} className="pb-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(item => {
                const m = STATUS[item.status] || STATUS.OK;
                return (
                  <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">{item.code}</td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[140px] truncate">{item.name}</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">{item.category}</td>
                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-semibold">{Number(item.currentStock || 0).toFixed(1)}</td>
                    <td className="py-2 px-3 text-slate-400 dark:text-slate-500 text-xs">{item.alertLevel}</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">₹{Number(item.ratePerUnit || item.salePrice || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs">{fmt(item.value)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.badge} ${m.text}`}>{m.label || item.status}</span>
                    </td>
                  </tr>
                );
              })}
              {!loading && paginatedData.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-xs">No data found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 rounded-xl">
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing page {page} of {totalPages} ({totalItems} items)
            </div>
            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
              />
            </div>
            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {totalItems} records
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

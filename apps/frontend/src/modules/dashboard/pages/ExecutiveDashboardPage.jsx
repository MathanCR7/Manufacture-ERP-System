import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users,
  BarChart2, Zap, Factory, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];

const fmt = (n, digits = 0) => {
  const num = Number(n || 0);
  if (num >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(1)}Cr`;
  if (num >= 1_00_000)    return `₹${(num / 1_00_000).toFixed(1)}L`;
  if (num >= 1_000)       return `₹${(num / 1_000).toFixed(digits)}K`;
  return `₹${num.toFixed(digits)}`;
};

const TT_STYLE = {
  contentStyle: { background: 'var(--tt-bg,#1e293b)', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
};

function KPICard({ title, value, sub, icon: Icon, accent, trend, loading }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-0.5 relative overflow-hidden`}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</span>
        <div className="p-2 rounded-xl" style={{ background: accent + '22' }}>
          <Icon size={15} style={{ color: accent }} />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">
        {loading ? <span className="inline-block h-7 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" /> : value}
      </div>
      {sub && (
        <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
          {trend === 'up' && <ArrowUpRight size={12} />}
          {trend === 'down' && <ArrowDownRight size={12} />}
          {sub}
        </div>
      )}
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

export default function ExecutiveDashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { const r = await api.get('/dashboard/executive'); setData(r.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const d   = data || {};
  const growth = parseFloat(d.revenueGrowth || 0);

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🏢 Executive Dashboard
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Business overview · live from database</p>
        </div>
        <button
          onClick={() => load(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors shadow-sm"
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KPICard title="Total Revenue"    value={fmt(d.totalRevenue)}         sub={`${growth >= 0 ? '+' : ''}${growth}% vs last month`} icon={DollarSign}  accent="#6366f1" trend={growth >= 0 ? 'up' : 'down'} loading={loading} />
        <KPICard title="Net Profit"       value={fmt(d.netProfit)}            sub={`${d.profitMargin}% margin`}                          icon={TrendingUp}   accent="#10b981" trend={d.netProfit >= 0 ? 'up' : 'down'} loading={loading} />
        <KPICard title="This Month"       value={fmt(d.currentMonthRevenue)}  sub="Revenue MTD"                                          icon={BarChart2}    accent="#8b5cf6" loading={loading} />
        <KPICard title="Total Expenses"   value={fmt(d.totalExpenses)}        sub="All time"                                             icon={TrendingDown}  accent="#f59e0b" trend="down" loading={loading} />
        <KPICard title="Inventory Value"  value={fmt(d.inventoryValue)}       sub={`RM: ${fmt(d.rmInventoryValue)}`}                    icon={Package}      accent="#3b82f6" loading={loading} />
        <KPICard title="OEE Score"        value={loading ? '…' : `${d.oeeScore || 0}%`}  sub="Equip. Effectiveness"                    icon={Zap}          accent="#f59e0b" loading={loading} />
        <KPICard title="Active Batches"   value={loading ? '…' : d.activeBatches ?? '—'} sub={`${d.completedBatches ?? 0} completed`}  icon={Factory}      accent="#ec4899" loading={loading} />
        <KPICard title="Customers"        value={loading ? '…' : d.topCustomers?.length ?? '—'} sub="Top contributors"                  icon={Users}        accent="#14b8a6" loading={loading} />
      </div>

      {/* Revenue Trend + OEE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card title="Revenue vs Expenses (12 Months)" accent="#6366f1">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={d.monthlyRevenue || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={55} />
                <Tooltip {...TT_STYLE} formatter={v => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Area type="monotone" dataKey="revenue"  stroke="#6366f1" strokeWidth={2} fill="url(#revG)" name="Revenue"  dot={false} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expG)" name="Expenses" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title="OEE Breakdown" accent="#f59e0b">
          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-5xl font-black text-indigo-500 dark:text-indigo-400">{d.oeeScore || 0}%</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-6">Overall Equipment Effectiveness</div>
            {[
              { label: 'Availability', val: parseFloat(d.availability || 0), color: '#6366f1' },
              { label: 'Performance',  val: parseFloat(d.performance  || 0), color: '#10b981' },
              { label: 'Quality',      val: parseFloat(d.quality      || 0), color: '#f59e0b' },
            ].map(b => (
              <div key={b.label} className="w-full flex items-center gap-2 mb-2.5 text-xs">
                <span className="w-20 text-slate-500 dark:text-slate-400 flex-shrink-0">{b.label}</span>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.val}%`, background: b.color }} />
                </div>
                <span className="w-9 text-right font-semibold" style={{ color: b.color }}>{b.val}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Order Pipeline + Top Products + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Order Pipeline" accent="#3b82f6">
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(d.orderPipeline || {}).map(([k, v], i) => (
              <div key={k} className="flex-1 min-w-[90px] bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-slate-800 dark:text-slate-100">{v}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{k}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={Object.entries(d.orderPipeline || {}).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={3} dataKey="value">
                {Object.keys(d.orderPipeline || {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...TT_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Products by Revenue" accent="#10b981">
          <ul className="space-y-2.5">
            {(d.topProducts || []).map((p, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 truncate">{p.name}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.revenue)}</span>
              </li>
            ))}
            {!loading && (!d.topProducts || d.topProducts.length === 0) && (
              <li className="text-xs text-slate-400 text-center py-4">No sales data yet</li>
            )}
          </ul>
        </Card>

        <Card title="Top Customers" accent="#ec4899">
          <ul className="space-y-2.5">
            {(d.topCustomers || []).map((c, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 truncate">{c.name}</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.revenue)}</span>
              </li>
            ))}
            {!loading && (!d.topCustomers || d.topCustomers.length === 0) && (
              <li className="text-xs text-slate-400 text-center py-4">No customer data yet</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

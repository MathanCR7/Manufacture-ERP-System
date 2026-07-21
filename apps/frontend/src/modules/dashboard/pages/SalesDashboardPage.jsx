import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, ShoppingBag, TrendingUp, Users, Star,
  RefreshCw, ArrowUpRight, ArrowDownRight
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

const STATUS_COLORS = {
  Pending: '#f59e0b', Confirmed: '#3b82f6', 'In Production': '#8b5cf6',
  'Ready for Shipment': '#10b981', Delivered: '#22c55e', Cancelled: '#ef4444'
};
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6','#8b5cf6'];

const TT = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
};

function KPICard({ title, value, sub, icon: Icon, accent, trend, loading, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-900/60 hover:bg-slate-50/20 dark:hover:bg-slate-950/20' : 'hover:-translate-y-0.5'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</span>
        <div className="p-2 rounded-xl group-hover:scale-110 transition-transform duration-300" style={{ background: accent + '22' }}>
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

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || '#64748b';
  return (
    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: c + '22', color: c }}>{status}</span>
  );
}

export default function SalesDashboardPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { const r = await api.get('/dashboard/sales'); setData(r.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { load(); }, []);
  const d = data || {};

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">



      {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard title="Today's Revenue"   value={fmt(d.todaySales?.revenue)}  sub={`${d.todaySales?.orders || 0} orders`}           icon={DollarSign} accent="#10b981" loading={loading} onClick={() => navigate('/sales/list')} />
        <KPICard title="Month Revenue"     value={fmt(d.monthSales?.revenue)}  sub={`${d.monthSales?.orders || 0} orders`}            icon={TrendingUp}  accent="#6366f1" loading={loading} onClick={() => navigate('/sales/list')} />
        <KPICard title="Year Revenue"      value={fmt(d.yearSales?.revenue)}   sub={`${d.yearSales?.orders || 0} total`}              icon={ShoppingBag} accent="#8b5cf6" loading={loading} onClick={() => navigate('/sales/list')} />
        <KPICard title="Conversion Rate"   value={`${d.conversionRate || 0}%`} sub="Quote → Confirmed"                                icon={Star}        accent="#f59e0b" loading={loading} onClick={() => navigate('/sales/list')} />
        <KPICard title="New Customers"     value={d.newCustomers || 0}         sub={`of ${d.totalCustomers || 0} total`}              icon={Users}       accent="#ec4899" loading={loading} onClick={() => navigate('/parties/customers')} />
      </div>

      {/* Daily Chart + Status Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card title="Daily Revenue (Last 14 Days)" accent="#10b981">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={d.dailySales || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="salG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="date"    tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={55} />
                <Tooltip {...TT} formatter={v => fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#salG)" name="Revenue" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <Card title="Order Status Breakdown" accent="#6366f1">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={Object.entries(d.orderStatusBreakdown || {}).map(([k, v]) => ({ name: k, value: v.count }))}
                cx="50%" cy="45%" innerRadius={40} outerRadius={80} paddingAngle={3} dataKey="value">
                {Object.keys(d.orderStatusBreakdown || {}).map((k, i) => (
                  <Cell key={k} fill={STATUS_COLORS[k] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Products + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Top Selling Products" accent="#f59e0b">
          <div className="space-y-3">
            {(d.topSellingProducts || []).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700 dark:text-slate-300 truncate mb-1">{p.name}</div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (p.revenue / (d.topSellingProducts[0]?.revenue || 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(p.revenue)}</div>
                  <div className="text-[10px] text-slate-400">{p.qty} units</div>
                </div>
              </div>
            ))}
            {!loading && (!d.topSellingProducts || d.topSellingProducts.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-4">No sales data yet</p>
            )}
          </div>
        </Card>

        <Card title="Top Customers" accent="#ec4899">
          <div className="space-y-3">
            {(d.topCustomers || []).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700 dark:text-slate-300 truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-400">{c.orders} orders · {c.type}</div>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{fmt(c.revenue)}</span>
              </div>
            ))}
            {!loading && (!d.topCustomers || d.topCustomers.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-4">No customer data yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card title="Recent Orders" accent="#3b82f6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {['Reference', 'Customer', 'Products', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className="pb-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.recentOrders || []).map(o => (
                <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">{o.referenceNo || `ORD-${o.id?.substring(0,6)}`}</td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{o.customerName}</td>
                  <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500 max-w-[160px] truncate">{o.productNames}</td>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{fmt(o.totalSubtotal)}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={o.status} /></td>
                  <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
              {!loading && (!d.recentOrders || d.recentOrders.length === 0) && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-400 text-xs">No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

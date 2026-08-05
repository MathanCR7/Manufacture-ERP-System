import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users,
  BarChart2, Zap, Factory, ArrowUpRight, ArrowDownRight, RefreshCw,
  Percent, Briefcase, Layers, ShoppingBag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const PIE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const fmt = (n) => {
  const num = Number(n || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const TT_STYLE = {
  contentStyle: { 
    background: 'rgba(15, 23, 42, 0.95)', 
    border: '1px solid rgba(51, 65, 85, 0.5)', 
    borderRadius: '12px', 
    fontSize: '12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
  },
  itemStyle: { color: '#f8fafc' }, 
  labelStyle: { color: '#94a3b8', fontWeight: 'bold' }
};

function KPICard({ title, value, sub, icon: Icon, gradient, trend, loading, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 relative overflow-hidden transition-all duration-300 hover:shadow-md group ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-900/60 hover:bg-slate-50/20 dark:hover:bg-slate-950/20' : 'hover:-translate-y-0.5'
      }`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</span>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 text-slate-500 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">
        {loading ? <span className="inline-block h-7 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" /> : value}
      </div>
      {sub && (
        <div className="text-xs">
          {trend === 'up' && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">
              <ArrowUpRight size={12} />
              {sub}
            </span>
          )}
          {trend === 'down' && (
            <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-455 font-semibold bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-full">
              <ArrowDownRight size={12} />
              {sub}
            </span>
          )}
          {trend === 'neutral' && (
            <span className="text-slate-400 dark:text-slate-500 font-medium">
              {sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { 
      const r = await api.get('/dashboard/executive'); 
      setData(r.data); 
    } catch (e) { 
      setError(e.message); 
    } finally { 
      setLoading(false); 
      setBusy(false); 
    }
  };

  useEffect(() => { 
    load(); 
  }, []);

  const d = data || {};
  const growth = parseFloat(d.revenueGrowth || 0);

  const getOEELabel = (score) => {
    if (score >= 85) return { text: 'World Class (Excellent)', color: 'text-emerald-500 bg-emerald-500/10' };
    if (score >= 70) return { text: 'Good (Optimal)', color: 'text-indigo-500 bg-indigo-500/10' };
    return { text: 'Needs Improvement', color: 'text-amber-500 bg-amber-500/10' };
  };

  const oeeLabel = getOEELabel(d.oeeScore || 0);

  return (
    <div className="space-y-8 bg-[#f8fafc] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">
      


      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>Failed to connect to backend: <strong>{error}</strong>. Please ensure the database is running.</span>
        </div>
      )}

      {/* Primary Financial Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard 
          title="Total Revenue" 
          value={fmt(d.totalRevenue)} 
          sub={`${growth >= 0 ? '+' : ''}${growth}% vs MTD last month`} 
          icon={DollarSign} 
          gradient="from-indigo-500 to-indigo-600" 
          trend={growth >= 0 ? 'up' : 'down'} 
          loading={loading} 
          onClick={() => navigate('/sales/list?from=executive')}
        />
        <KPICard 
          title="Net Profit" 
          value={fmt(d.netProfit)} 
          sub={`${d.profitMargin || 0}% Net Margin`} 
          icon={TrendingUp} 
          gradient="from-emerald-500 to-emerald-600" 
          trend={d.netProfit >= 0 ? 'up' : 'down'} 
          loading={loading} 
          onClick={() => navigate('/dashboard/finance')}
        />
        <KPICard 
          title="Monthly Income MTD" 
          value={fmt(d.currentMonthRevenue)} 
          sub="Current month sales value" 
          icon={BarChart2} 
          gradient="from-violet-500 to-violet-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/sales/list?from=executive')}
        />
        <KPICard 
          title="Total Expenses" 
          value={fmt(d.totalExpenses)} 
          sub="Direct + general expenses" 
          icon={TrendingDown} 
          gradient="from-amber-500 to-amber-600" 
          trend="down" 
          loading={loading} 
          onClick={() => navigate('/finance/expenses?from=executive')}
        />
        <KPICard 
          title="Direct Costs" 
          value={fmt(d.totalDirectCosts)} 
          sub="Cost of Goods Sold" 
          icon={Briefcase} 
          gradient="from-orange-500 to-orange-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/purchase-orders?from=executive')}
        />
        <KPICard 
          title="General Expenses" 
          value={fmt(d.totalGeneralExpenses)} 
          sub="Operations & utility costs" 
          icon={Layers} 
          gradient="from-rose-550 to-rose-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/finance/expenses?from=executive')}
        />
      </div>

      {/* Operational Highlights Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard 
          title="Inventory Assets" 
          value={fmt(d.inventoryValue)} 
          sub={`RM Valuation: ${fmt(d.rmInventoryValue)}`} 
          icon={Package} 
          gradient="from-blue-500 to-blue-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/rm/stock?from=executive')}
        />
        <KPICard 
          title="OEE Score" 
          value={loading ? '…' : `${d.oeeScore || 0}%`} 
          sub={oeeLabel.text} 
          icon={Zap} 
          gradient="from-orange-500 to-orange-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/dashboard/production')}
        />
        <KPICard 
          title="Active Batches" 
          value={loading ? '…' : d.activeBatches ?? '0'} 
          sub={`${d.completedBatches ?? 0} batches finished`} 
          icon={Factory} 
          gradient="from-pink-500 to-pink-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/production/batches?from=executive')}
        />
        <KPICard 
          title="Top Contributors" 
          value={loading ? '…' : `${d.topCustomers?.length ?? 0} Clients`} 
          sub="Representing top revenue accounts" 
          icon={Users} 
          gradient="from-cyan-500 to-cyan-600" 
          trend="neutral" 
          loading={loading} 
          onClick={() => navigate('/parties/customers?from=executive')}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="p-6 pb-0">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-105">Revenue vs Expenses</CardTitle>
                  <CardDescription>Aggregate monthly sales performance matched against operational costs.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.monthlyRevenue || []} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={70} />
                    <Tooltip {...TT_STYLE} formatter={v => fmt(v)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: '15px' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fill="url(#revG)" name="Revenue" dot={false} />
                    <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={3} fill="url(#expG)" name="Expenses" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OEE Breakdown Bar Chart */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-105">OEE Score Metric</CardTitle>
            <CardDescription>Overall equipment effectiveness components</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-center">
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative flex items-center justify-center">
                <div className="text-6xl font-black text-indigo-650 dark:text-indigo-400 tracking-tighter">
                  {d.oeeScore || 0}%
                </div>
              </div>
              <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${oeeLabel.color}`}>
                {oeeLabel.text}
              </span>
              <p className="text-[10px] text-slate-400 mt-2 text-center max-w-[200px]">
                Availability × Performance × Quality metrics from actual runs.
              </p>
            </div>

            <div className="space-y-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              {[
                { label: 'Availability', val: parseFloat(d.availability || 0), color: '#6366f1', desc: 'Active run time ratio' },
                { label: 'Performance',  val: parseFloat(d.performance  || 0), color: '#10b981', desc: 'Output capacity speed' },
                { label: 'Quality',      val: parseFloat(d.quality      || 0), color: '#f59e0b', desc: 'Passed vs tested ratio' },
              ].map(b => (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-350">{b.label}</span>
                    <span className="font-bold" style={{ color: b.color }}>{b.val}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.val}%`, background: b.color }} />
                  </div>
                  <span className="text-[9px] text-slate-400 block">{b.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline & Top Contributors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Order Pipeline */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">Sales Pipeline</CardTitle>
            <CardDescription>Counts of active customer orders grouped by status.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-3 gap-2 mb-6">
              {Object.entries(d.orderPipeline || {}).slice(0, 3).map(([status, count]) => (
                <div key={status} className="bg-slate-50 dark:bg-slate-850 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800">
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{count}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold mt-1 truncate">{status}</div>
                </div>
              ))}
            </div>
            
            {Object.keys(d.orderPipeline || {}).length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">No pending orders.</div>
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={Object.entries(d.orderPipeline || {}).map(([k, v]) => ({ name: k, value: v }))} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={45} 
                      outerRadius={65} 
                      paddingAngle={4} 
                      dataKey="value"
                    >
                      {Object.keys(d.orderPipeline || {}).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...TT_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">Top Products by Revenue</CardTitle>
            <CardDescription>Most demanded items from orders history.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <ul className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (d.topProducts || []).length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">No sales transactions yet.</div>
              ) : (
                (d.topProducts || []).map((p, i) => {
                  const maxRevenue = Math.max(...(d.topProducts || []).map(x => x.revenue), 1);
                  const percentage = ((p.revenue / maxRevenue) * 100).toFixed(0);
                  
                  return (
                    <li key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-300 truncate">{p.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-indigo-650 dark:text-indigo-400">{fmt(p.revenue)}</span>
                          <span className="text-[10px] text-slate-400 block">{p.qty} units sold</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">Leading Accounts</CardTitle>
            <CardDescription>Top billing client accounts.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <ul className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (d.topCustomers || []).length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">No active customer accounts.</div>
              ) : (
                (d.topCustomers || []).map((c, i) => {
                  const maxRevenue = Math.max(...(d.topCustomers || []).map(x => x.revenue), 1);
                  const percentage = ((c.revenue / maxRevenue) * 105).toFixed(0);
                  
                  return (
                    <li key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-full bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-300 truncate">{c.name}</span>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

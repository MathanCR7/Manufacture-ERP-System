import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, RefreshCw, BarChart2
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

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6','#8b5cf6','#a78bfa','#34d399'];
const TT = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
};

function KPICard({ title, value, sub, icon: Icon, accent, trend, loading, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 md:p-5 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group min-w-0 ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-900/60 hover:bg-slate-50/20 dark:hover:bg-slate-950/20' : 'hover:-translate-y-0.5'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="flex justify-between items-start mb-2 sm:mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate mr-1">{title}</span>
        <div className="p-1.5 sm:p-2 rounded-xl group-hover:scale-110 transition-transform duration-300 flex-shrink-0" style={{ background: accent + '22' }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
      </div>
      <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mb-1 truncate" title={typeof value === 'string' ? value : undefined}>
        {loading ? <span className="inline-block h-6 sm:h-7 w-20 sm:w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" /> : value}
      </div>
      {sub && <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

function Card({ title, accent = '#6366f1', children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />
        <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function FinanceDashboardPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { const r = await api.get('/dashboard/finance'); setData(r.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { load(); }, []);
  const d      = data || {};
  const rev    = d.revenue || {};
  const exp    = d.expenses || {};
  const profit = d.profit || {};
  const ar     = d.accountsReceivable || {};
  const ap     = d.accountsPayable || {};

  return (
    <div className="space-y-4 sm:space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-3.5 sm:p-6 lg:p-8 min-h-screen">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>💰 Finance Dashboard</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Revenue, expenses, cash flow & P&L analytics</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={busy}
          className="self-start sm:self-auto px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">⚠️ {error}</div>}

      {/* KPIs: 1 col on small phones, 2 on phones, 3 on tablet, 6 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <KPICard title="Total Revenue"     value={fmt(rev.total)}    sub={`Month: ${fmt(rev.month)}`}      icon={DollarSign}  accent="#10b981" loading={loading} onClick={() => navigate('/sales/list?from=finance')} />
        <KPICard title="Year Revenue"      value={fmt(rev.year)}     sub="Financial year"                  icon={TrendingUp}   accent="#6366f1" loading={loading} onClick={() => navigate('/sales/list?from=finance')} />
        <KPICard title="Total Expenses"    value={fmt(exp.total)}    sub={`Month: ${fmt(exp.month)}`}      icon={TrendingDown} accent="#ef4444" loading={loading} onClick={() => navigate('/finance/expenses?from=finance')} />
        <KPICard title="Net Profit"        value={fmt(profit.total)} sub={`${profit.margin}% margin`}      icon={BarChart2}    accent={Number(profit.total) >= 0 ? '#10b981' : '#ef4444'} loading={loading} onClick={() => navigate('/finance/expenses?from=finance')} />
        <KPICard title="Accounts Rec."     value={fmt(ar.total)}     sub={`${ar.count || 0} customers`}   icon={CreditCard}   accent="#f59e0b" loading={loading} onClick={() => navigate('/parties/customers?from=finance')} />
        <KPICard title="Accounts Pay."     value={fmt(ap.total)}     sub="Outstanding balances"            icon={Wallet}       accent="#8b5cf6" loading={loading} onClick={() => navigate('/purchase-orders?from=finance')} />
      </div>

      {/* P&L Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card title="Revenue vs Expenses vs Profit (12 Months)" accent="#10b981">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={d.monthlyFinancials || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={55} />
                <Tooltip {...TT} formatter={v => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="revenue"  name="Revenue"  fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="profit"   name="Profit"   fill="#6366f1" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title="Expenses by Category" accent="#f59e0b">
          {(d.expensesByCategory || []).length === 0 && !loading
            ? <p className="text-xs text-slate-400 text-center py-6">No expense data</p>
            : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={d.expensesByCategory || []} cx="50%" cy="50%" innerRadius={30} outerRadius={70} dataKey="amount" nameKey="category" paddingAngle={3}>
                      {(d.expensesByCategory || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {(d.expensesByCategory || []).slice(0, 5).map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-500 dark:text-slate-400">{e.category || 'Other'}</span>
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </Card>
      </div>

      {/* AR / AP Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Top Receivables (Customers)" accent="#f59e0b">
          {(d.topReceivables || []).length === 0 && !loading
            ? <p className="text-xs text-emerald-500 text-center py-4">✅ No outstanding receivables</p>
            : (
              <div className="space-y-2">
                {(d.topReceivables || []).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800/50 gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
                      <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 truncate">{c.name}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )
          }
        </Card>

        <Card title="Top Payables (Suppliers)" accent="#8b5cf6">
          {(d.topPayables || []).length === 0 && !loading
            ? <p className="text-xs text-emerald-500 text-center py-4">✅ No outstanding payables</p>
            : (
              <div className="space-y-2">
                {(d.topPayables || []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800/50 gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
                      <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 truncate">{s.name}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 shrink-0">{fmt(s.amount)}</span>
                  </div>
                ))}
              </div>
            )
          }
        </Card>
      </div>
    </div>
  );
}

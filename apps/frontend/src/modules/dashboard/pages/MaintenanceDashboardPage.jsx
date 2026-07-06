import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Wrench, HardDrive, AlertTriangle, TrendingDown,
  DollarSign, Activity, RefreshCw, Shield, Calendar
} from 'lucide-react';

const fmt = (n, d = 0) => {
  const num = Number(n || 0);
  if (num >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(1)}Cr`;
  if (num >= 1_00_000)    return `₹${(num / 1_00_000).toFixed(1)}L`;
  if (num >= 1_000)       return `₹${(num / 1_000).toFixed(d)}K`;
  return `₹${num.toFixed(d)}`;
};
const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#14b8a6','#8b5cf6','#ef4444'];
const TT = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
};

const daysUntil = (date) => {
  if (!date) return '—';
  const d = Math.ceil((new Date(date) - new Date()) / 86400000);
  return d <= 0 ? 'Overdue' : `${d}d`;
};

function KPICard({ title, value, sub, icon: Icon, accent, loading }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 relative overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5">
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

export default function MaintenanceDashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { const r = await api.get('/dashboard/maintenance'); setData(r.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { load(); }, []);
  const d = data || {};
  const s = d.summary || {};

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">



      {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard title="Total Assets"      value={s.totalAssets || 0}                sub={`${s.activeAssets || 0} active`}            icon={HardDrive}   accent="#6366f1" loading={loading} />
        <KPICard title="In Maintenance"    value={s.inMaintenanceAssets || 0}        sub="Under repair"                               icon={Wrench}      accent="#f59e0b" loading={loading} />
        <KPICard title="Availability"      value={`${s.availability || 0}%`}        sub={`${s.downtime || 0}% downtime`}             icon={Activity}    accent="#10b981" loading={loading} />
        <KPICard title="Asset Value"       value={fmt(s.totalAssetValue)}            sub={`Book: ${fmt(s.currentBookValue)}`}         icon={DollarSign}  accent="#3b82f6" loading={loading} />
        <KPICard title="Depreciation"      value={fmt(s.totalDepreciation)}          sub={`Monthly: ${fmt(s.monthlyDepreciation)}`}  icon={TrendingDown} accent="#8b5cf6" loading={loading} />
        <KPICard title="Maint. Cost (Mo.)" value={fmt(s.maintenanceCostMonth)}       sub="Asset POs this month"                       icon={Shield}      accent="#ec4899" loading={loading} />
      </div>

      {/* Category Pie + Department Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Assets by Category" accent="#6366f1">
          {(d.assetsByCategory || []).length === 0 && !loading
            ? <p className="text-xs text-slate-400 text-center py-6">No assets found</p>
            : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={d.assetsByCategory || []} cx="50%" cy="50%" innerRadius={30} outerRadius={70} dataKey="value" nameKey="category" paddingAngle={3}>
                      {(d.assetsByCategory || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {(d.assetsByCategory || []).slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-500 dark:text-slate-400">{a.category || 'Unknown'}</span>
                      </div>
                      <div className="flex gap-3 text-right">
                        <span className="text-slate-400">{a.count} units</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(a.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </Card>

        <Card title="Assets by Department" accent="#3b82f6">
          {(d.assetsByDept || []).length === 0 && !loading
            ? <p className="text-xs text-slate-400 text-center py-6">No departments</p>
            : (
              <div className="space-y-3">
                {(d.assetsByDept || []).slice(0, 8).map((dept, i) => {
                  const maxVal = Math.max(...(d.assetsByDept || []).map(x => x.value || 0), 1);
                  const pct = Math.min(100, (dept.value / maxVal) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500 dark:text-slate-400 truncate">{dept.department || 'N/A'}</span>
                        <div className="flex gap-3 flex-shrink-0 ml-2">
                          <span className="text-slate-400">{dept.count}</span>
                          <span className="font-semibold" style={{ color: COLORS[i % COLORS.length] }}>{fmt(dept.value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>
      </div>

      {/* Upcoming Maintenance + Warranty Expiry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="⚠️ Upcoming Maintenance (Next 7 Days)" accent="#f59e0b">
          {(d.upcomingMaintenance || []).length === 0 && !loading
            ? <p className="text-xs text-emerald-500 text-center py-4">✅ No scheduled maintenance</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      {['Asset ID','Name','Category','Location','Due In'].map(h => (
                        <th key={h} className="pb-2 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(d.upcomingMaintenance || []).map(a => {
                      const due = daysUntil(a.nextMaintenance);
                      const dc  = due === 'Overdue' ? 'text-rose-600 dark:text-rose-400' : Number(due?.replace('d','')) <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
                      return (
                        <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">{a.assetId}</td>
                          <td className="py-2 px-2 text-slate-700 dark:text-slate-300 max-w-[100px] truncate text-xs">{a.assetName}</td>
                          <td className="py-2 px-2 text-slate-400 dark:text-slate-500 text-xs">{a.category}</td>
                          <td className="py-2 px-2 text-slate-400 dark:text-slate-500 text-xs">{a.location || '—'}</td>
                          <td className={`py-2 px-2 font-bold text-xs ${dc}`}>{due}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </Card>

        <Card title="🔐 Warranty Expiring (Next 30 Days)" accent="#ef4444">
          {(d.warrantyExpiring || []).length === 0 && !loading
            ? <p className="text-xs text-emerald-500 text-center py-4">✅ No warranties expiring soon</p>
            : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {(d.warrantyExpiring || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800/50">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center flex-shrink-0">
                      <Shield size={14} className="text-rose-500 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate">{a.assetId} — {a.assetName}</div>
                      <div className="text-[10px] text-slate-400">Dept: {a.department || 'N/A'}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">{daysUntil(a.warrantyExpiry)}</div>
                      <div className="text-[10px] text-slate-400">{a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString('en-IN') : '—'}</div>
                    </div>
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

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Factory, Zap, AlertTriangle, CheckCircle2,
  RefreshCw, Activity, BarChart2
} from 'lucide-react';

const TT = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
};

const STATUS_META = {
  'In Progress': { color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400' },
  'Completed':   { color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
  'qc_passed':   { color: '#22c55e', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600 dark:text-green-400' },
  'qc_failed':   { color: '#ef4444', bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400' },
  'Pending':     { color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400' },
  'Planned':     { color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' },
};

function KPICard({ title, value, sub, icon: Icon, accent, loading }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-0.5 relative overflow-hidden">
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

function OeeRing({ value, color, label }) {
  const r = 38, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${(value / 100) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-base font-black mt-1" style={{ color }}>{value}%</div>
      <div className="text-[10px] text-slate-400 dark:text-slate-500">{label}</div>
    </div>
  );
}

export default function ProductionDashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try { const r = await api.get('/dashboard/production'); setData(r.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => { load(); }, []);
  const d = data || {};
  const statusCounts = d.statusCounts || {};

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">



      {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard title="OEE Score"       value={`${d.oee || 0}%`}                sub="Overall Equipment Effectiveness" icon={Zap}          accent="#f59e0b" loading={loading} />
        <KPICard title="Batches (Month)" value={d.totalBatchesMonth || 0}         sub={`${Object.values(statusCounts).reduce((a,b)=>a+b,0)} all time`} icon={Factory} accent="#8b5cf6" loading={loading} />
        <KPICard title="Planned Qty"     value={`${Math.round(d.plannedQtyMonth || 0)} units`} sub="Target" icon={BarChart2} accent="#3b82f6" loading={loading} />
        <KPICard title="Actual Qty"      value={`${Math.round(d.actualQtyMonth || 0)} units`}  sub={`${d.plannedQtyMonth > 0 ? Math.round((d.actualQtyMonth/d.plannedQtyMonth)*100) : 0}% of plan`} icon={Activity} accent="#10b981" loading={loading} />
        <KPICard title="QC Pass Rate"    value={`${d.qcPassRate || 0}%`}          sub={`${d.qcPassed || 0} pass / ${d.qcFailed || 0} fail`} icon={CheckCircle2} accent="#22c55e" loading={loading} />
        <KPICard title="Scrap Rate"      value={`${d.scrapRate || 0}%`}           sub={`${Number(d.totalLossKg || 0).toFixed(1)} kg loss`}  icon={AlertTriangle} accent="#ef4444" loading={loading} />
      </div>

      {/* OEE Rings + Work Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="OEE Components" accent="#f59e0b">
          <div className="flex justify-around py-2">
            <OeeRing value={parseFloat(d.availability || 0)} color="#6366f1" label="Availability" />
            <OeeRing value={parseFloat(d.performance  || 0)} color="#10b981" label="Performance"  />
            <OeeRing value={parseFloat(d.quality      || 0)} color="#f59e0b" label="Quality"      />
          </div>
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
            <span className="text-sm text-slate-500 dark:text-slate-400">Overall OEE</span>
            <span className={`text-2xl font-black ${d.oee >= 85 ? 'text-emerald-500' : d.oee >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>{d.oee || 0}%</span>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Work Order Status" accent="#6366f1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(statusCounts).map(([status, count]) => {
                const m = STATUS_META[status] || { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' };
                return (
                  <div key={status} className={`${m.bg} rounded-xl p-3`}>
                    <div className={`text-2xl font-black ${m.text}`}>{count}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{status}</div>
                  </div>
                );
              })}
              {Object.keys(statusCounts).length === 0 && !loading && (
                <p className="col-span-3 text-xs text-slate-400 text-center py-6">No batches found</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Weekly Trend */}
      <Card title="Weekly Production Trend" accent="#3b82f6">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={d.weeklyTrend || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...TT} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar dataKey="planned" name="Planned" fill="#3b82f640" radius={[4,4,0,0]} />
            <Bar dataKey="actual"  name="Actual"  fill="#6366f1"   radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Batches */}
      <Card title="Recent Production Batches" accent="#8b5cf6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {['Reference','Product','Status','Qty','Done','Progress','QC','Start'].map(h => (
                  <th key={h} className="pb-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.recentBatches || []).map(b => {
                const m = STATUS_META[b.status] || { text: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' };
                const qcColor = b.qcStatus === 'Pass' || b.qcStatus === 'pass' ? 'text-emerald-500' : b.qcStatus === 'Fail' ? 'text-rose-500' : 'text-slate-400';
                return (
                  <tr key={b.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">{b.referenceNo || b.id?.substring(0,8)}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{b.productName}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.bg} ${m.text}`}>{b.status}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{b.quantity}</td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">{b.partiallyDoneQty}</td>
                    <td className="py-2.5 px-3 min-w-[90px]">
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${b.donePercent}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{b.donePercent}%</span>
                    </td>
                    <td className={`py-2.5 px-3 text-xs font-bold ${qcColor}`}>{b.qcStatus}</td>
                    <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">{b.startDate ? new Date(b.startDate).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                );
              })}
              {!loading && (!d.recentBatches || d.recentBatches.length === 0) && (
                <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-xs">No batches found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

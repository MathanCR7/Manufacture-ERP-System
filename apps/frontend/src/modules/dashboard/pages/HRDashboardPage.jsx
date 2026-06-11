import React, { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Users, UserCheck, UserX, Clock, TrendingUp, RefreshCw, Activity, Shield, Calendar, Search } from 'lucide-react';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6','#8b5cf6'];
const ROLE_COLORS = {
  MAIN_MASTER: '#6366f1', SUPERVISOR: '#8b5cf6', PURCHASE_ACCOUNTANT: '#10b981',
  MATERIALS_RECEIVER: '#3b82f6', LAB_ASSISTANT: '#f59e0b',
  PRODUCTION_STAFF: '#ec4899', SALES_TEAM: '#14b8a6'
};
const TT = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: '#e2e8f0' }, labelStyle: { color: '#94a3b8' }
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

const fmtDur = s => { if (!s) return '—'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; };

export default function HRDashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [users, setUsers]     = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  const load = async (refresh = false) => {
    refresh ? setBusy(true) : setLoading(true);
    try {
      const params = selectedUser ? { userId: selectedUser } : {};
      const r = await api.get('/dashboard/hr', { params });
      setData(r.data);
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setBusy(false); }
  };

  useEffect(() => {
    api.get('/attendance/users')
      .then(res => setUsers(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [selectedUser]);

  const d   = data || {};
  const att = d.attendance || {};

  return (
    <div className="space-y-6 bg-[#F4F3FF] dark:bg-slate-950 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-screen">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">🧑‍💼 HR & Workforce Dashboard</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Headcount, attendance & workforce analytics · 100% Live</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">User Filter:</span>
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All Team Overview</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
              ))}
            </select>
          </div>
          <button onClick={() => load(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors shadow-sm">
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard title="Total Employees"  value={d.totalEmployees || 0}        sub={`${d.activeEmployees || 0} active`}    icon={Users}      accent="#8b5cf6" loading={loading} />
        <KPICard title="Today Present"    value={att.todayPresent || 0}         sub="Checked in"                             icon={UserCheck}   accent="#10b981" loading={loading} />
        <KPICard title="Currently Out"    value={att.todayOut || 0}             sub="Checked out"                            icon={UserX}       accent="#f59e0b" loading={loading} />
        <KPICard title="Attendance Rate"  value={`${att.attendanceRate || 0}%`} sub="This month"                            icon={TrendingUp}  accent="#6366f1" loading={loading} />
        <KPICard title="Absenteeism"      value={`${att.absenteeismRate || 0}%`} sub="This month"                           icon={Activity}    accent="#ef4444" loading={loading} />
        <KPICard title="Avg Daily Hours"  value={`${att.avgDailyHours || 0}h`}  sub="Per employee"                         icon={Clock}       accent="#14b8a6" loading={loading} />
      </div>

      {/* Weekly Chart + Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card title={selectedUser ? "User Weekly Attendance (Last 7 Days)" : "Weekly Attendance (Last 7 Days)"} accent="#6366f1">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={d.weeklyAttendance || []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="day"  tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TT} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="present" name="Present" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="absent"  name="Absent"  fill="#ef444460" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card title="Role Distribution" accent="#8b5cf6">
          <div className="space-y-3">
            {(d.roleDistribution || []).map((r, i) => {
              const total = d.totalEmployees || 1;
              const pct   = Math.round((r.count / total) * 100);
              const color = ROLE_COLORS[r.role] || COLORS[i % COLORS.length];
              const label = r.role?.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
              return (
                <div key={r.role}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 truncate">{label}</span>
                    <span className="font-semibold flex-shrink-0 ml-2" style={{ color }}>{r.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
            {(!d.roleDistribution || d.roleDistribution.length === 0) && !loading && (
              <p className="text-xs text-slate-400 text-center py-4">No data</p>
            )}
          </div>
        </Card>
      </div>

      {/* workforce comparison report */}
      <div className="grid grid-cols-1 gap-5">
        <Card title="Workforce Engagement Comparison Report (Days Present vs. Avg Shift Hours)" accent="#f59e0b">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={d.userStats || []} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" orientation="left" stroke="#10b981" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Days Present', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 10 } }} />
              <YAxis yAxisId="right" orientation="right" stroke="#6366f1" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'Avg Hours/Day', angle: 90, position: 'insideRight', style: { fill: '#94a3b8', fontSize: 10 } }} />
              <Tooltip {...TT} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar yAxisId="left" dataKey="daysPresent" name="Days Present" fill="#10b981" radius={[4,4,0,0]} />
              <Bar yAxisId="right" dataKey="avgHours" name="Avg Hours/Day" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Employee Stats + Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title={selectedUser ? "User Attendance Details" : "Top Attendance (This Month)"} accent="#10b981">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Name','Role','Days Present','Avg Hours'].map(h => (
                    <th key={h} className="pb-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.userStats || []).sort((a,b) => b.daysPresent - a.daysPresent).map(u => {
                  const c = ROLE_COLORS[u.role] || '#6366f1';
                  return (
                    <tr key={u.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">{u.name}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: c + '22', color: c }}>
                          {u.role?.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{u.daysPresent}</td>
                      <td className="py-2 px-3 text-slate-400 dark:text-slate-500">{u.avgHours}h</td>
                    </tr>
                  );
                })}
                {(!d.userStats || d.userStats.length === 0) && !loading && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-xs">No attendance data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={selectedUser ? "User Recent Login Activity" : "Recent Login Activity"} accent="#ec4899">
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {(d.recentSessions || []).map((s, i) => {
              const c = ROLE_COLORS[s.role] || '#6366f1';
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800/50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c + '22' }}>
                    <Shield size={14} style={{ color: c }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{s.name}</div>
                    <div className="text-[10px] text-slate-400">{s.role?.replace(/_/g,' ')} · {s.loginAt ? new Date(s.loginAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'}</div>
                  </div>
                  <span className="text-xs text-teal-500 dark:text-teal-400 flex-shrink-0">{fmtDur(s.duration)}</span>
                </div>
              );
            })}
            {(!d.recentSessions || d.recentSessions.length === 0) && !loading && (
              <p className="text-xs text-slate-400 text-center py-4">No session data</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

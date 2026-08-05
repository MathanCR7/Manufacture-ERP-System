import React, { useState, useEffect, useCallback } from 'react';
import { Clock, LogIn, LogOut, Download, Search, Users, Calendar, Timer, TrendingUp } from 'lucide-react';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const fmt = (dt) => dt ? new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDuration = (mins) => {
  if (!mins && mins !== 0) return 'N/A';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? '-' : '';
  return `${sign}${h}.${String(m).padStart(2,'0')} Hour(s)`;
};

const CheckInOutPage = () => {
  const user = useAuthStore(s => s.user);
  const isAdmin = ['MAIN_MASTER', 'SUPERVISOR'].includes(user?.role);

  const [status, setStatus] = useState({ isCheckedIn: false, activeLog: null });
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [activeTab, setActiveTab] = useState('shifts'); // 'shifts' or 'sessions'

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const r = await api.get('/attendance/status');
      setStatus(r.data);
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (isAdmin && filterUser) params.userId = filterUser;
      const endpoint = isAdmin ? '/attendance/all' : '/attendance/my';
      const r = await api.get(endpoint, { params });
      setLogs(r.data);
    } catch { setLogs([]); } finally { setLoading(false); }
  }, [isAdmin, fromDate, toDate, filterUser]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const params = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (isAdmin && filterUser) params.userId = filterUser;
      const endpoint = isAdmin ? '/attendance/sessions/all' : '/attendance/sessions/my';
      const r = await api.get(endpoint, { params });
      setSessions(r.data);
    } catch { setSessions([]); } finally { setSessionsLoading(false); }
  }, [isAdmin, fromDate, toDate, filterUser]);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    fetchSessions();
  }, [fetchStatus, fetchLogs, fetchSessions]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/attendance/users').then(r => setAllUsers(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-in');
      showToast('✅ Work hour has been started successfully!');
      await fetchStatus(); await fetchLogs();
    } catch (e) { showToast(e.response?.data?.error || 'Check-in failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-out', { note: note || 'Thank You.' });
      showToast('✅ Checked out successfully!');
      setNote('');
      await fetchStatus(); await fetchLogs();
    } catch (e) { showToast(e.response?.data?.error || 'Check-out failed', 'error'); }
    finally { setActionLoading(false); }
  };

  const filtered = logs.filter(l => {
    const s = search.toLowerCase();
    return !s || l.user?.name?.toLowerCase().includes(s) || fmtDate(l.checkIn).includes(s);
  });

  const filteredSessions = sessions.filter(l => {
    const s = search.toLowerCase();
    return !s || l.user?.name?.toLowerCase().includes(s) || fmtDate(l.loginAt).includes(s) || l.ip?.includes(s);
  });

  const totalHours = logs.reduce((acc, l) => acc + (l.duration || 0), 0);

  const fmtDurSeconds = (secs) => {
    if (!secs && secs !== 0) return 'Active';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6">
      <DashboardBackButton />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 transition-all ${toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {isAdmin ? 'Attendance & Sessions Timeline' : 'My Check In / Out'}
        </h1>
        {isAdmin && (
          <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">
            <Users className="w-4 h-4" /> Viewing all team logs
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Shifts', value: logs.length, icon: Calendar, color: 'indigo' },
          { label: 'Total Shift Hours', value: fmtDuration(totalHours), icon: Timer, color: 'emerald' },
          { label: 'Total Login Sessions', value: sessions.length, icon: Users, color: 'purple' },
          { label: 'Shift Status', value: status.isCheckedIn ? 'Checked In' : 'Checked Out', icon: Clock, color: status.isCheckedIn ? 'green' : 'slate' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`w-8 h-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Check In/Out Card */}
      {!isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="text-center space-y-4">
            {status.isCheckedIn && status.activeLog ? (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Live — Checked In
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  Last Check In {fmt(status.activeLog.checkIn)}
                </p>
                <input
                  type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Add a note (optional)..."
                  className="w-full max-w-xs mx-auto block px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  onClick={handleCheckOut} disabled={actionLoading}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-semibold shadow-lg shadow-red-200 dark:shadow-red-900/30 transition-all flex items-center gap-2 mx-auto disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" /> {actionLoading ? 'Processing…' : 'Check Out'}
                </button>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-slate-400 rounded-full" />
                  Not Checked In
                </div>
                <p className="text-xl font-semibold text-slate-600 dark:text-slate-400">Ready to start your shift?</p>
                <button
                  onClick={handleCheckIn} disabled={actionLoading}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all flex items-center gap-2 mx-auto disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" /> {actionLoading ? 'Processing…' : 'Check In'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'shifts' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Work Shifts (Attendance Logs)
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === 'sessions' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Login Sessions
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Filter by User</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">All Users</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>)}
              </select>
            </div>
          )}
          <button onClick={() => { fetchLogs(); fetchSessions(); }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
            Search
          </button>
          <button onClick={() => { setFromDate(''); setToDate(''); setFilterUser(''); }}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm transition-colors">
            Clear
          </button>
          <div className="ml-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-400 w-48" />
          </div>
        </div>
      </div>

      {/* Tables */}
      {activeTab === 'shifts' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{filtered.length} shift records</p>
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SN</th>
                  {isAdmin && <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-indigo-600 dark:text-indigo-400">In Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Out Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time Count</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">No shift records found.</td></tr>
                ) : filtered.map((log, i) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{i + 1}</td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{log.user?.name}</p>
                          <p className="text-xs text-slate-400">{log.user?.role?.replace(/_/g, ' ')}</p>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{fmtDate(log.checkIn)}</td>
                    <td className="px-5 py-4 font-medium text-indigo-600 dark:text-indigo-400">{fmt(log.checkIn)}</td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                      {log.checkOut ? fmt(log.checkOut) : <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">● Active</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-medium ${(log.duration || 0) < 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {fmtDuration(log.duration)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 max-w-[150px] truncate">{log.note || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{filteredSessions.length} login sessions</p>
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SN</th>
                  {isAdmin && <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>}
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Login Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-teal-600 dark:text-teal-400">Login Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Logout Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {sessionsLoading ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">Loading…</td></tr>
                ) : filteredSessions.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">No login sessions found.</td></tr>
                ) : filteredSessions.map((sess, i) => (
                  <tr key={sess.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{i + 1}</td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{sess.user?.name}</p>
                          <p className="text-xs text-slate-400">{sess.user?.role?.replace(/_/g, ' ')}</p>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">{fmtDate(sess.loginAt)}</td>
                    <td className="px-5 py-4 font-medium text-teal-600 dark:text-teal-400">{fmt(sess.loginAt)}</td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                      {sess.logoutAt ? fmt(sess.logoutAt) : <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">● Active</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300 font-medium">
                      {fmtDurSeconds(sess.durationSeconds)}
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{sess.ip || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInOutPage;

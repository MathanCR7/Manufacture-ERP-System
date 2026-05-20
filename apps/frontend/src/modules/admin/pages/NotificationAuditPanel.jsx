import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Eye, Calendar } from 'lucide-react';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

const PhaseColors = {
  PO_CREATED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  GRN_SUBMITTED: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  LAB_RM_APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LAB_RM_REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
  LAB_RM_RESAMPLE: 'bg-amber-100 text-amber-800 border-amber-200',
  FINAL_QTY_SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
  PRODUCTION_STARTED: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  PRODUCTION_COMPLETED: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  PRODUCTION_QC_PASSED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PRODUCTION_QC_FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const NotificationAuditPanel = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications/audit');
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const calculateElapsed = (start, end) => {
    if (!start || !end) return '-';
    const diffMs = new Date(end) - new Date(start);
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins} min`;
  };

  const formatDate = (dateString, includeSeconds = false) => {
    if (!dateString) return '-';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    if (includeSeconds) options.second = '2-digit';
    return new Date(dateString).toLocaleString('en-GB', options);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    // Define headers
    const headers = [
      'Notification ID',
      'Type',
      'Event Time',
      'Message',
      'Seen By',
      'Seen By Role',
      'Seen At',
      'Elapsed Time'
    ];

    // Map logs to CSV rows
    const rows = logs.map(log => [
      log.id,
      log.type,
      formatDate(log.eventAt, true),
      log.message.replace(/"/g, '""'), // escape quotes
      log.userSeenBy ? log.userSeenBy.name : 'Unread',
      log.userSeenBy ? log.userSeenBy.role : '-',
      log.seenAt ? formatDate(log.seenAt, true) : '-',
      calculateElapsed(log.eventAt, log.seenAt)
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(value => `"${value}"`).join(','))
    ].join('\n');

    // Create file and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `notifications_audit_report_${dateStr}_${timeStr}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      title: 'Export Success',
      text: 'Notification audit report CSV downloaded successfully.',
      icon: 'success',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#0f172a',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Notification Audit</h1>
          <p className="text-slate-500 mt-1">Full audit trail of all system notifications and seen status</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={fetchAuditLogs} className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-4 px-6 font-semibold">Notification ID / Type</th>
                <th className="py-4 px-6 font-semibold">Event Time</th>
                <th className="py-4 px-6 font-semibold">Message Snapshot</th>
                <th className="py-4 px-6 font-semibold">Seen By</th>
                <th className="py-4 px-6 font-semibold">Seen At</th>
                <th className="py-4 px-6 font-semibold text-right">Elapsed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-6">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 font-mono mb-1">{log.id.split('-')[0]}...</span>
                      <span className={`inline-flex self-start text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${PhaseColors[log.type] || 'bg-slate-100 text-slate-600'}`}>
                        {log.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-slate-600 dark:text-slate-300 font-medium">
                    <div className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {formatDate(log.eventAt, true)}
                    </div>
                  </td>
                  <td className="py-3 px-6 max-w-xs truncate text-slate-500" title={log.message}>
                    {log.message.substring(0, 45)}...
                  </td>
                  <td className="py-3 px-6">
                    {log.userSeenBy ? (
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold mr-2">
                          {log.userSeenBy.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-700 dark:text-slate-200 font-medium">{log.userSeenBy.name}</span>
                          <span className="text-[10px] text-slate-400">{log.userSeenBy.role.replace('_', ' ')}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unread</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-slate-600 dark:text-slate-300">
                    {log.seenAt ? (
                      <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        {formatDate(log.seenAt, true)}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-slate-500 dark:text-slate-400">
                    {calculateElapsed(log.eventAt, log.seenAt)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    No notification audit logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationAuditPanel;

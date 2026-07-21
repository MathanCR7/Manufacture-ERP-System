import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Eye, Calendar } from 'lucide-react';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import { Pagination } from '@/components/ui/Pagination';

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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications/audit');
      setLogs(data || []);
      setCurrentPage(1);
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

  // Paginate logs
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const paginated = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Notification Audit</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Full audit trail of all system notifications and seen status</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={fetchAuditLogs} 
            className="flex items-center px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900 transition h-9 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md font-bold text-xs disabled:opacity-50 h-9 cursor-pointer border-none"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export Report
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-650 dark:text-slate-300 whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
              <tr>
                <th className="py-3.5 px-6 font-bold">Notification ID / Type</th>
                <th className="py-3.5 px-6 font-bold">Event Time</th>
                <th className="py-3.5 px-6 font-bold">Message Snapshot</th>
                <th className="py-3.5 px-6 font-bold">Seen By</th>
                <th className="py-3.5 px-6 font-bold">Seen At</th>
                <th className="py-3.5 px-6 font-bold text-right">Elapsed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 font-semibold bg-slate-50/10">
                    Loading audit trail...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 font-semibold bg-slate-50/10">
                    No notification audit logs found
                  </td>
                </tr>
              ) : (
                paginated.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-105 dark:border-slate-800 last:border-none">
                    <td className="py-3 px-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-404 font-mono font-bold mb-0.5">{log.id.split('-')[0]}...</span>
                        <span className={`inline-flex self-start text-[9px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${PhaseColors[log.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                          {log.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-slate-700 dark:text-slate-350 font-semibold">
                      <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-404 shrink-0" />
                        {formatDate(log.eventAt, true)}
                      </div>
                    </td>
                    <td className="py-3 px-6 max-w-xs truncate text-slate-550 dark:text-slate-400 font-semibold" title={log.message}>
                      {log.message.substring(0, 45)}...
                    </td>
                    <td className="py-3 px-6">
                      {log.userSeenBy ? (
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 flex items-center justify-center text-[10px] font-extrabold mr-2">
                            {log.userSeenBy.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-800 dark:text-slate-200 font-bold">{log.userSeenBy.name}</span>
                            <span className="text-[9px] text-slate-404 font-bold">{log.userSeenBy.role.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic font-semibold">Unread</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-slate-600 dark:text-slate-350">
                      {log.seenAt ? (
                        <div className="flex items-center text-emerald-650 dark:text-emerald-450 font-bold">
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          {formatDate(log.seenAt, true)}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-slate-500">
                      {calculateElapsed(log.eventAt, log.seenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, logs.length)} of {logs.length} entries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-404 font-medium order-3">
              Total entries: {logs.length} records
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationAuditPanel;

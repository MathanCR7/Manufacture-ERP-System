import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Clock, User, HardDrive, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { api } from '@/lib/axios';
import { format } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

/* ── Human-readable field labels ── */
const FIELD_LABELS = {
  name: 'RM Name',
  quantity: 'Quantity',
  amount: 'Amount (₹)',
  uomId: 'UOM ID',
  uomName: 'UOM',
  expectedDelivery: 'Expected Delivery',
  supplierId: 'Supplier ID',
  supplierName: 'Supplier',
  referenceNo: 'Reference No',
  rmId: 'RM ID',
  status: 'Status',
  createdBy: 'Created By',
  createdByName: 'Created By Name',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
  editedBy: 'Edited By (ID)',
  editedByName: 'Edited By',
  editedByRole: 'Editor Role',
};

/* ── Format a raw value for display ── */
function fmtVal(key, val) {
  if (val === null || val === undefined || val === '') return <span className="italic text-slate-400">—</span>;
  if (key.toLowerCase().includes('delivery') || key.toLowerCase().includes('at')) {
    try { return format(new Date(val), 'dd MMM yyyy, HH:mm'); } catch { /* fall through */ }
  }
  if (key === 'amount') return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

/* ── Diff panel for a single log entry ── */
function DiffPanel({ oldValue, newValue }) {
  if (!oldValue && !newValue) {
    return <p className="text-xs text-slate-400 p-4">No detail captured.</p>;
  }

  const allKeys = Array.from(
    new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})])
  ).filter(k => !['uomId', 'supplierId', 'createdBy', 'editedBy'].includes(k));

  // Separate changed vs unchanged
  const changedKeys = allKeys.filter(k => {
    const ov = (oldValue || {})[k];
    const nv = (newValue || {})[k];
    const ovStr = ov instanceof Date ? ov.toISOString() : String(ov ?? '');
    const nvStr = nv instanceof Date ? nv.toISOString() : String(nv ?? '');
    return ovStr !== nvStr;
  });
  const unchangedKeys = allKeys.filter(k => !changedKeys.includes(k));

  return (
    <div className="text-xs font-mono bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {changedKeys.length > 0 && (
        <>
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 font-semibold text-xs">
            ✏️ Changed Fields ({changedKeys.length})
          </div>
          {changedKeys.map(k => (
            <div key={k} className="grid grid-cols-[160px_1fr_20px_1fr] items-start gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-medium not-italic truncate">
                {FIELD_LABELS[k] || k}
              </span>
              <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded break-all">
                {fmtVal(k, (oldValue || {})[k])}
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400 mt-0.5 mx-auto shrink-0" />
              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded break-all">
                {fmtVal(k, (newValue || {})[k])}
              </span>
            </div>
          ))}
        </>
      )}

      {unchangedKeys.length > 0 && (
        <details>
          <summary className="px-4 py-2 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none font-sans">
            Unchanged fields ({unchangedKeys.length}) — click to expand
          </summary>
          {unchangedKeys.map(k => (
            <div key={k} className="grid grid-cols-[160px_1fr] gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-600">
              <span className="font-sans font-medium not-italic">{FIELD_LABELS[k] || k}</span>
              <span>{fmtVal(k, (oldValue || {})[k])}</span>
            </div>
          ))}
        </details>
      )}

      {changedKeys.length === 0 && (
        <div className="px-4 py-3 text-slate-400 text-xs font-sans">No field changes detected.</div>
      )}
    </div>
  );
}

/* ── Action badge ── */
function ActionBadge({ action }) {
  const map = {
    CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${map[action] || 'bg-slate-100 text-slate-600'}`}>
      {action}
    </span>
  );
}

export default function AuditLogListPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState(null);
  const itemsPerPage = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', currentPage],
    queryFn: async () => {
      const response = await api.get(`/audit-logs?page=${currentPage}&limit=${itemsPerPage}`);
      return response.data;
    }
  });

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-[600px] w-full" /></div>;
  }

  const logs = data?.data || [];
  const meta = data?.meta || { totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
          <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            System-wide monitoring of all Create, Update, and Delete actions. Click a row to see old → new value diff.
          </p>
        </div>
      </div>

      <Card className="dark:bg-[#111827] dark:border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="dark:border-slate-700">
                  <TableHead className="font-semibold text-xs whitespace-nowrap w-40">Timestamp</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">User</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Role</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">IP Address</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Action</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Table</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap">Record ID</TableHead>
                  <TableHead className="font-semibold text-xs whitespace-nowrap text-center">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">No audit logs found</TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedRow === log.id;
                    const hasDetails = !!(log.oldValue || log.newValue);
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow
                          className={`dark:border-slate-700 transition-colors ${hasDetails ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''} ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                          onClick={() => hasDetails && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <TableCell className="text-xs dark:text-slate-300">
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{format(new Date(log.createdAt), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="text-slate-400 pl-4.5 mt-0.5">{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                          </TableCell>

                          <TableCell className="text-sm dark:text-slate-300 font-medium">
                            <div className="flex items-center space-x-2">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{log.user?.name || log.userId}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-sm dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {log.user?.role || 'UNKNOWN'}
                            </span>
                          </TableCell>

                          <TableCell className="text-xs dark:text-slate-300">
                            <div className="flex items-center space-x-1.5">
                              <HardDrive className="w-3 h-3 text-slate-400" />
                              <span className="font-mono">{log.ip}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-sm">
                            <ActionBadge action={log.action} />
                          </TableCell>

                          <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">{log.tableName}</TableCell>

                          <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-500" title={log.recordId}>
                            {log.recordId.substring(0, 8)}…
                          </TableCell>

                          <TableCell className="text-center">
                            {hasDetails ? (
                              <button
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : log.id); }}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isExpanded ? 'Hide' : 'View'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded diff row */}
                        {isExpanded && (
                          <TableRow className="dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50">
                            <TableCell colSpan={8} className="p-4">
                              <div className="mb-2 flex items-center gap-3 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Record: <span className="font-mono">{log.recordId}</span>
                                </span>
                                <span>·</span>
                                <span>Table: <strong>{log.tableName}</strong></span>
                                <span>·</span>
                                <span>{format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm:ss')}</span>
                              </div>
                              <DiffPanel oldValue={log.oldValue} newValue={log.newValue} />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <div>
              Showing {logs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} – {Math.min(currentPage * itemsPerPage, meta.total)} of {meta.total} entries
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50 transition-opacity"
              >
                Previous
              </button>
              <div className="px-3 py-1 border rounded bg-indigo-500 text-white border-indigo-500 font-medium">
                {currentPage}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={currentPage >= meta.totalPages || meta.totalPages === 0}
                className="px-3 py-1 border rounded bg-slate-50 dark:bg-slate-800 dark:border-slate-700 disabled:opacity-50 transition-opacity"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

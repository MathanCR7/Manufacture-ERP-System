import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Clock, User, HardDrive, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { api } from '@/lib/axios';
import { format } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';

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
  if (val === null || val === undefined || val === '') return <span className="italic text-slate-404 font-medium">—</span>;
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
    return <p className="text-[10px] text-slate-400 p-4">No detail captured.</p>;
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
    <div className="text-[11px] font-mono bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      {changedKeys.length > 0 && (
        <>
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-wider">
            ✏️ Changed Fields ({changedKeys.length})
          </div>
          {changedKeys.map(k => (
            <div key={k} className="grid grid-cols-[160px_1fr_20px_1fr] items-start gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-950/50">
              <span className="text-slate-500 dark:text-slate-400 font-sans font-extrabold text-[10px] uppercase shrink-0">
                {FIELD_LABELS[k] || k}
              </span>
              <span className="text-rose-600 dark:text-rose-450 bg-rose-500/10 px-2 py-0.5 rounded-lg break-all font-bold">
                {fmtVal(k, (oldValue || {})[k])}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 mx-auto shrink-0" />
              <span className="text-emerald-650 dark:text-emerald-450 bg-emerald-500/10 px-2 py-0.5 rounded-lg break-all font-bold">
                {fmtVal(k, (newValue || {})[k])}
              </span>
            </div>
          ))}
        </>
      )}

      {unchangedKeys.length > 0 && (
        <details className="outline-none">
          <summary className="px-4 py-2 text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none font-sans font-bold text-[10px] uppercase tracking-wider outline-none">
            Unchanged fields ({unchangedKeys.length}) — click to expand
          </summary>
          {unchangedKeys.map(k => (
            <div key={k} className="grid grid-cols-[160px_1fr] gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-850 text-slate-450 dark:text-slate-500 font-sans">
              <span className="font-extrabold text-[10px] uppercase">{FIELD_LABELS[k] || k}</span>
              <span className="font-semibold text-xs">{fmtVal(k, (oldValue || {})[k])}</span>
            </div>
          ))}
        </details>
      )}

      {changedKeys.length === 0 && (
        <div className="px-4 py-3 text-slate-400 text-xs font-sans font-semibold">No field changes detected.</div>
      )}
    </div>
  );
}

/* ── Action badge ── */
function ActionBadge({ action }) {
  const map = {
    CREATE: 'bg-emerald-500/10 text-emerald-650 border-emerald-500/20',
    UPDATE: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    DELETE: 'bg-rose-500/10 text-rose-650 border-rose-500/20',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-lg text-3xs font-extrabold border uppercase tracking-wider ${map[action] || 'bg-slate-100 text-slate-600'}`}>
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
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      <div className="flex items-center space-x-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-xl shrink-0">
          <ShieldAlert className="w-6 h-6 text-indigo-650 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Audit Logs</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            System-wide monitoring of all Create, Update, and Delete actions. Click a row to see old → new value diff.
          </p>
        </div>
      </div>

      <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-55 dark:bg-slate-950 text-slate-505 dark:text-slate-455 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                <TableRow className="dark:border-slate-800">
                  <TableHead className="py-3 whitespace-nowrap w-40">Timestamp</TableHead>
                  <TableHead className="py-3 whitespace-nowrap">User</TableHead>
                  <TableHead className="py-3 whitespace-nowrap">Role</TableHead>
                  <TableHead className="py-3 whitespace-nowrap">IP Address</TableHead>
                  <TableHead className="py-3 whitespace-nowrap">Action</TableHead>
                  <TableHead className="py-3 whitespace-nowrap">Table</TableHead>
                  <TableHead className="py-3 whitespace-nowrap">Record ID</TableHead>
                  <TableHead className="py-3 whitespace-nowrap text-center w-24">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 font-semibold bg-slate-50/10">No audit logs found</TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedRow === log.id;
                    const hasDetails = !!(log.oldValue || log.newValue);
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow
                          className={`hover:bg-slate-50/40 dark:hover:bg-slate-805/20 transition-colors border-b border-slate-105 dark:border-slate-800 last:border-none ${hasDetails ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}
                          onClick={() => hasDetails && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <TableCell className="text-xs dark:text-slate-350 py-3 font-semibold">
                            <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-white">
                              <Clock className="w-3.5 h-3.5 text-slate-404 shrink-0" />
                              <span>{format(new Date(log.createdAt), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 pl-5 mt-0.5 font-bold font-mono">{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                          </TableCell>

                          <TableCell className="text-xs dark:text-slate-300 font-bold">
                            <div className="flex items-center space-x-2">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{log.user?.name || log.userId}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-xs dark:text-slate-300 py-3">
                            <span className="px-2 py-0.5 rounded-lg text-3xs font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border dark:border-slate-700 uppercase tracking-wide">
                              {log.user?.role?.replace(/_/g, ' ') || 'SYSTEM'}
                            </span>
                          </TableCell>

                          <TableCell className="text-xs dark:text-slate-300 font-bold font-mono">
                            <div className="flex items-center space-x-1.5 text-slate-500">
                              <HardDrive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{log.ip}</span>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            <ActionBadge action={log.action} />
                          </TableCell>

                          <TableCell className="text-3xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{log.tableName}</TableCell>

                          <TableCell className="text-3xs font-mono font-bold text-slate-400" title={log.recordId}>
                            {log.recordId.substring(0, 8)}…
                          </TableCell>

                          <TableCell className="text-center py-3">
                            {hasDetails ? (
                              <button
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-3xs font-bold bg-indigo-50 text-indigo-650 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/80 transition-colors border border-indigo-100/50 dark:border-indigo-900/30 cursor-pointer h-7"
                                onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : log.id); }}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isExpanded ? 'Hide' : 'View'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-bold">—</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded diff row */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/30 dark:bg-slate-950/20 border-b border-slate-105 dark:border-slate-800">
                            <TableCell colSpan={8} className="p-4">
                              <div className="mb-2 flex flex-wrap items-center gap-3 text-3xs text-slate-404 font-bold uppercase tracking-wider">
                                <span className="text-slate-700 dark:text-slate-300">
                                  Record ID: <span className="font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400 lowercase">{log.recordId}</span>
                                </span>
                                <span>·</span>
                                <span>Table: <strong className="text-slate-700 dark:text-slate-350">{log.tableName}</strong></span>
                                <span>·</span>
                                <span>Timestamp: <span className="font-mono">{format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm:ss')}</span></span>
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

          {/* Reusable Pagination footer */}
          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-[11px] text-slate-555 dark:text-slate-400 font-medium order-2 sm:order-1">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, meta.total)} of {meta.total} entries
              </div>

              <div className="order-1 sm:order-2">
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={meta.totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>

              <div className="text-xs text-slate-404 font-medium order-3">
                Total entries: {meta.total} records
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

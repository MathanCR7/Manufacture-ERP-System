import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Plus, Search, Trash2, Eye, FileText, Download, Printer,
  Settings2, FileSpreadsheet, Edit, ChevronRight, Loader2,
  Package, TrendingUp, Clock, CheckCircle2, XCircle, Filter
} from 'lucide-react';
import useAuthStore from '@/app/store/authStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const STATUS_ORDER = ['PENDING', 'ORDERED', 'RECEIVED'];
const STATUS_LABELS = {
  PENDING: 'Pending', ORDERED: 'Ordered', RECEIVED: 'Received',
  APPROVED: 'Approved', DELETED: 'Deleted'
};
const STATUS_COLORS = {
  PENDING:  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  ORDERED:  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  RECEIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  APPROVED: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-500/30',
};

function StatusChip({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatusAdvanceButton({ po, onSuccess }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const currentIdx = STATUS_ORDER.indexOf(po.status);
  if (currentIdx === -1 || currentIdx >= STATUS_ORDER.length - 1) return null;
  const nextStatus = STATUS_ORDER[currentIdx + 1];

  const handleAdvance = async () => {
    setLoading(true);
    try {
      await api.patch(`/grn/po/${po.id}/status`, { status: nextStatus });
      qc.invalidateQueries({ queryKey: ['pos'] });
      if (onSuccess) onSuccess(nextStatus);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const colorMap = {
    ORDERED:  'bg-blue-600 hover:bg-blue-700',
    RECEIVED: 'bg-emerald-600 hover:bg-emerald-700',
  };

  return (
    <Button
      size="sm"
      onClick={handleAdvance}
      disabled={loading}
      className={`h-7 px-2.5 text-xs text-white gap-1 ${colorMap[nextStatus] || 'bg-indigo-600 hover:bg-indigo-700'}`}
      title={`Mark as ${nextStatus}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
      {nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}
    </Button>
  );
}

// ── Summary stat card ──────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

// ── Export helpers ─────────────────────────────────────────────────
function exportToCSV(rows) {
  const headers = ['SN','Date','Reference No','Raw Material','RM Code','UOM','Supplier','Status','Grand Total','Payment Status'];
  const csvRows = [
    headers.join(','),
    ...rows.map((po, i) => [
      i + 1,
      format(new Date(po.createdAt), 'dd-MM-yyyy'),
      po.referenceNo,
      `"${po.name}"`,
      po.rmId,
      po.uomLabel || '-',
      `"${po.supplierName || '-'}"`,
      po.status,
      Number(po.amount).toFixed(2),
      'Unpaid'
    ].join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `purchase-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(rows) {
  const win = window.open('', '_blank');
  if (!win) return;
  const tableRows = rows.map((po, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${format(new Date(po.createdAt), 'dd-MM-yyyy')}</td>
      <td><strong>${po.referenceNo}</strong></td>
      <td>${po.name}<br/><small style="color:#94a3b8">${po.rmId}</small></td>
      <td>${po.uomLabel || '-'}</td>
      <td>${po.supplierName || '-'}</td>
      <td>${po.status}</td>
      <td style="text-align:right">₹${Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td><span style="color:#f59e0b;font-weight:600">Unpaid</span></td>
    </tr>`).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Purchase Orders</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1e293b;font-size:12px}
      h1{font-size:20px;margin-bottom:4px}
      p{color:#64748b;margin:0 0 16px}
      table{width:100%;border-collapse:collapse}
      th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
      td{border-bottom:1px solid #e2e8f0;padding:7px 10px}
      tr:nth-child(even) td{background:#f8fafc}
    </style></head><body>
    <h1>Purchase Orders</h1>
    <p>Generated on ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
    <table>
      <thead><tr>
        <th>SN</th><th>Date</th><th>Ref No</th><th>Raw Material</th>
        <th>UOM</th><th>Supplier</th><th>Status</th><th>Grand Total</th><th>Payment</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
  </body></html>`);
  win.document.close();
}

// ── Main Component ──────────────────────────────────────────────────
export default function POListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const canChangeStatus = ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const { data: pos = [], isLoading, error } = useQuery({
    queryKey: ['pos'],
    queryFn: async () => {
      const response = await api.get('/rm/po');
      return response.data;
    }
  });

  // Fetch all raw materials to get UOM data
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: async () => {
      const res = await api.get('/item-setup/raw-material');
      return res.data;
    }
  });

  // Build a map: rmCode → UOM label
  const rmUomMap = {};
  rawMaterials.forEach(rm => {
    const uomLabel = rm.uoms?.length > 0
      ? rm.uoms.map(u => u.abbreviation || u.name).join(' / ')
      : rm.unitId || rm.consumptionUnit || '';
    if (rm.code) rmUomMap[rm.code] = uomLabel;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await api.delete(`/rm/po/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pos'] }); }
  });

  // Augment POs with real UOM label
  const augmentedPos = pos.map(po => ({
    ...po,
    uomLabel: rmUomMap[po.rmId] || po.uom || '-'
  }));

  const filteredPOs = augmentedPos.filter(po => {
    const matchSearch =
      po.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.rmId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Stats
  const totalAmount = augmentedPos.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount = augmentedPos.filter(p => p.status === 'PENDING').length;
  const approvedCount = augmentedPos.filter(p => p.status === 'APPROVED').length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage all raw material purchase orders</p>
        </div>
        {['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
          <Link
            to="/purchase-orders/create"
            className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold h-10 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </Link>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}    label="Total POs"      value={augmentedPos.length}        color="bg-indigo-500" />
        <StatCard icon={Clock}      label="Pending"        value={pendingCount}                color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Approved"    value={approvedCount}               color="bg-emerald-500" />
        <StatCard icon={TrendingUp} label="Total Value"    value={`₹${(totalAmount/1000).toFixed(1)}K`} color="bg-violet-500" />
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/30"
                onClick={() => exportToCSV(filteredPOs)}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs gap-1.5 text-slate-600 dark:text-slate-400"
                onClick={() => window.print()}
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              <Button
                variant="outline" size="sm"
                className="h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-500/30"
                onClick={() => exportToPDF(filteredPOs)}
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-8 text-xs border border-slate-200 dark:border-slate-700 rounded-md px-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="ORDERED">Ordered</option>
                <option value="RECEIVED">Received</option>
                <option value="APPROVED">Approved</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search PO, RM, supplier..."
                className="pl-9 h-8 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="w-10 text-xs">SN</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Reference No</TableHead>
                <TableHead className="text-xs">Raw Material</TableHead>
                <TableHead className="text-xs">UOM</TableHead>
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs">Purchase Status</TableHead>
                <TableHead className="text-right text-xs">Grand Total</TableHead>
                <TableHead className="text-right text-xs">Paid</TableHead>
                <TableHead className="text-right text-xs">Due</TableHead>
                <TableHead className="text-xs">Payment</TableHead>
                <TableHead className="text-center text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 12 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-900 dark:text-slate-100">No purchase orders found</p>
                      <p className="text-sm text-slate-500">Try adjusting your search or filter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPOs.map((po, idx) => (
                  <TableRow key={po.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-slate-400 text-xs">{idx + 1}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(po.createdAt), 'dd-MM-yyyy')}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline"
                      >
                        {po.referenceNo}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{po.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{po.rmId}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        {po.uomLabel || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">{po.supplierName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusChip status={po.status} />
                        {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                          <StatusAdvanceButton po={po} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 text-sm">₹0.00</TableCell>
                    <TableCell className="text-right text-red-500 font-semibold text-sm">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                        Unpaid
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="h-7 w-7 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => navigate(`/purchase-orders/edit/${po.id}`)}
                            className="h-7 w-7 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete PO {po.referenceNo}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(po.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        {filteredPOs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
            <span>Showing {filteredPOs.length} of {augmentedPos.length} orders</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Total: ₹{filteredPOs.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

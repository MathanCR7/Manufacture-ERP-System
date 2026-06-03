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
import { SortSelect } from '@/components/ui/SortSelect';

const STATUS_ORDER = ['PENDING', 'ORDERED', 'RECEIVED'];
const STATUS_LABELS = {
  PENDING: 'Pending', ORDERED: 'Ordered', RECEIVED: 'Received',
  APPROVED: 'Approved', DELETED: 'Deleted'
};
const STATUS_COLORS = {
  PENDING:  'bg-amber-50/80 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20',
  ORDERED:  'bg-blue-50/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/60 dark:border-blue-500/20',
  RECEIVED: 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20',
  APPROVED: 'bg-violet-50/80 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200/60 dark:border-violet-500/20',
};
const STATUS_DOTS = {
  PENDING:  'bg-amber-500',
  ORDERED:  'bg-blue-500',
  RECEIVED: 'bg-emerald-500',
  APPROVED: 'bg-violet-500',
};

function StatusChip({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-50 text-slate-650 border-slate-200';
  const dotCls = STATUS_DOTS[status] || 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls} select-none`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
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
    ORDERED:  'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10',
    RECEIVED: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10',
  };

  return (
    <Button
      size="sm"
      onClick={handleAdvance}
      disabled={loading}
      className={`h-8 px-3 text-xs text-white gap-1.5 rounded-xl shadow-sm transition-all active:scale-[0.97] ${colorMap[nextStatus] || 'bg-indigo-600 hover:bg-indigo-700'}`}
      title={`Mark as ${nextStatus}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
      {nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}
    </Button>
  );
}

// ── Summary stat card ──────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, borderClass, bgClass, iconColorClass, isLoading }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border ${borderClass} rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgClass} ${iconColorClass} shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{label}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-16 mt-1" />
        ) : (
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 truncate">{value}</p>
        )}
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

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await api.delete(`/rm/po/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pos'] }); }
  });

  // Augment POs with UOM label directly from backend PO
  const augmentedPos = pos.map(po => ({
    ...po,
    uomLabel: po.uom || '-'
  }));

  const [sortBy, setSortBy] = useState('recent');
  const sortOptions = [
    { value: 'recent', label: 'Recent Raised' },
    { value: 'oldest', label: 'Oldest Raised' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'name_asc', label: 'Material: A to Z' },
    { value: 'name_desc', label: 'Material: Z to A' },
  ];

  const filteredPOs = augmentedPos.filter(po => {
    const matchSearch =
      po.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.rmId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sortedPOs = [...filteredPOs].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    if (sortBy === 'price_desc') {
      return Number(b.amount || 0) - Number(a.amount || 0);
    }
    if (sortBy === 'price_asc') {
      return Number(a.amount || 0) - Number(b.amount || 0);
    }
    if (sortBy === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '');
    }
    return 0;
  });

  // Stats
  const totalAmount = augmentedPos.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount = augmentedPos.filter(p => p.status === 'PENDING').length;
  const approvedCount = augmentedPos.filter(p => p.status === 'APPROVED').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage and track all raw material purchase orders</p>
        </div>
        {['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
          <Link
            to="/purchase-orders/create"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md shadow-slate-900/10 dark:shadow-none transition-all active:scale-[0.98] select-none"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </Link>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Package} 
          label="Total POs" 
          value={augmentedPos.length} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-indigo-50 dark:bg-indigo-950/30" 
          iconColorClass="text-indigo-600 dark:text-indigo-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={Clock} 
          label="Pending" 
          value={pendingCount} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-amber-50 dark:bg-amber-950/30" 
          iconColorClass="text-amber-600 dark:text-amber-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={CheckCircle2} 
          label="Approved" 
          value={approvedCount} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-emerald-50 dark:bg-emerald-950/30" 
          iconColorClass="text-emerald-600 dark:text-emerald-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={TrendingUp} 
          label="Total Value" 
          value={`₹${(totalAmount/1000).toFixed(1)}K`} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-violet-50 dark:bg-violet-950/30" 
          iconColorClass="text-violet-650 dark:text-violet-400" 
          isLoading={isLoading}
        />
      </div>

      {/* Table & List Card Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col gap-4">
            {/* Top Row: Search */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search by Purchase Order, RM Code, Supplier..."
                className="pl-10 h-10 w-full text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Bottom Row: Filter & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5 text-slate-400" /> Filter:
                  </span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="h-9 text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                  >
                    <option value="ALL">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="ORDERED">Ordered</option>
                    <option value="RECEIVED">Received</option>
                    <option value="APPROVED">Approved</option>
                  </select>
                </div>

                <SortSelect
                  value={sortBy}
                  onChange={setSortBy}
                  options={sortOptions}
                  className="w-full sm:w-auto"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  className="h-9 px-3 text-xs gap-1.5 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/30 rounded-xl transition-all"
                  onClick={() => exportToCSV(filteredPOs)}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 
                  <span className="hidden sm:inline">Excel</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-9 px-3 text-xs gap-1.5 text-red-700 bg-red-50/50 hover:bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-900/30 rounded-xl transition-all"
                  onClick={() => exportToPDF(filteredPOs)}
                >
                  <Download className="w-3.5 h-3.5" /> 
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-9 px-3 text-xs gap-1.5 text-slate-700 bg-slate-50 hover:bg-slate-105 border-slate-200 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800 rounded-xl transition-all"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5" /> 
                  <span className="hidden sm:inline">Print</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/75 dark:bg-slate-800/40">
              <TableRow>
                <TableHead className="w-12 text-xs font-semibold text-slate-500 uppercase tracking-wider">SN</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference No</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Raw Material</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">UOM</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Status</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Grand Total</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Due</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</TableHead>
                <TableHead className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</TableHead>
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
              ) : sortedPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-900 dark:text-slate-100">No purchase orders found</p>
                      <p className="text-sm text-slate-505">Try adjusting your search or filter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedPOs.map((po, idx) => (
                  <TableRow key={po.id} className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <TableCell className="font-semibold text-slate-400 text-xs">{idx + 1}</TableCell>
                    <TableCell className="text-xs text-slate-650 dark:text-slate-350 whitespace-nowrap">{format(new Date(po.createdAt), 'dd-MM-yyyy')}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="font-mono font-bold text-indigo-650 dark:text-indigo-400 text-xs hover:underline"
                      >
                        {po.referenceNo}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{po.name}</div>
                      <div className="text-[11px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">{po.rmId}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 px-2 py-0.5 rounded-md border border-slate-200/10">
                        {po.uomLabel || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-650 dark:text-slate-400 font-medium">{po.supplierName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusChip status={po.status} />
                        {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                          <StatusAdvanceButton po={po} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm text-slate-850 dark:text-slate-100">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-500 font-medium text-sm font-mono">₹0.00</TableCell>
                    <TableCell className="text-right text-red-500 dark:text-red-400 font-bold text-sm font-mono">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-205 dark:border-amber-500/20">
                        Unpaid
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => navigate(`/purchase-orders/edit/${po.id}`)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-650 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Delete Purchase Order?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-500 dark:text-slate-400 text-sm">
                                  Are you sure you want to delete PO <span className="font-mono font-semibold text-slate-850 dark:text-slate-100">{po.referenceNo}</span>? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border border-slate-200 dark:border-slate-800">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(po.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md hover:shadow-red-500/20"
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

        {/* Mobile View Card List */}
        <div className="md:hidden p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="pt-2 flex justify-between gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))
          ) : sortedPOs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">No purchase orders found</p>
                <p className="text-xs text-slate-505">Try adjusting your filters.</p>
              </div>
            </div>
          ) : (
            sortedPOs.map((po, idx) => (
              <div 
                key={po.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-3"
              >
                {/* Header: Ref & Date */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <button
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm hover:underline block text-left"
                    >
                      {po.referenceNo}
                    </button>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {format(new Date(po.createdAt), 'dd MMM yyyy')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusChip status={po.status} />
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20">
                      Unpaid
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="pt-2 pb-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-550 font-bold mb-0.5">
                      Raw Material
                    </span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={po.name}>
                      {po.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Code: {po.rmId}
                    </div>
                    <div className="mt-1">
                      <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 px-2 py-0.5 rounded border border-slate-200/10">
                        {po.uomLabel || '-'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-550 font-bold mb-0.5">
                      Supplier
                    </span>
                    <div className="text-slate-700 dark:text-slate-300 font-semibold truncate" title={po.supplierName}>
                      {po.supplierName || '-'}
                    </div>
                  </div>
                </div>

                {/* Financial Section */}
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl grid grid-cols-3 gap-2 text-center text-xs border border-slate-100 dark:border-slate-800/40">
                  <div>
                    <span className="block text-[9px] text-slate-400 dark:text-slate-500 mb-0.5">Grand Total</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 dark:text-slate-500 mb-0.5">Paid</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-500 font-mono">₹0.0</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-400 dark:text-slate-500 mb-0.5">Due</span>
                    <span className="font-bold text-red-500 dark:text-red-400 font-mono">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>

                {/* Card Action bar */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div>
                    {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                      <StatusAdvanceButton po={po} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="h-8 px-2.5 text-xs text-slate-650 dark:text-slate-350 border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                    {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/purchase-orders/edit/${po.id}`)}
                          className="h-8 px-2.5 text-xs text-blue-650 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs text-red-650 dark:text-red-404 border-red-200/50 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Delete Purchase Order?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500 dark:text-slate-400 text-sm">
                                Are you sure you want to delete PO <span className="font-mono font-semibold text-slate-850 dark:text-slate-100">{po.referenceNo}</span>? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="rounded-xl border border-slate-200 dark:border-slate-800">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(po.id)}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {filteredPOs.length > 0 && (
          <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 text-xs text-slate-500 dark:text-slate-405">
            <span>Showing {filteredPOs.length} of {augmentedPos.length} orders</span>
            <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/40">
              Total Value: ₹{filteredPOs.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import CreatePOPage from './CreatePOPage';
import EditPOPage from './EditPOPage';
import { format } from 'date-fns';
import {
  Plus, Search, Trash2, Eye, FileText, Download, Printer,
  ChevronRight, Loader2, Package, TrendingUp, Clock, CheckCircle2, Filter, FileSpreadsheet, Edit
} from 'lucide-react';
import useAuthStore from '@/app/store/authStore';
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
import { Pagination } from '@/components/ui/Pagination';

const STATUS_ORDER = ['PENDING', 'ORDERED', 'RECEIVED'];
const STATUS_LABELS = {
  PENDING: 'Pending', ORDERED: 'Ordered', RECEIVED: 'Received',
  APPROVED: 'Approved', DELETED: 'Deleted'
};
const STATUS_COLORS = {
  PENDING:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  ORDERED:  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  RECEIVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  APPROVED: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};
const STATUS_DOTS = {
  PENDING:  'bg-amber-500',
  ORDERED:  'bg-blue-500',
  RECEIVED: 'bg-emerald-500',
  APPROVED: 'bg-purple-500',
};

function StatusChip({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-655 border-slate-200';
  const dotCls = STATUS_DOTS[status] || 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${cls} select-none shadow-sm`}>
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
    ORDERED:  'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10 dark:shadow-blue-900/20',
    RECEIVED: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10 dark:shadow-emerald-900/20',
  };

  return (
    <Button
      size="sm"
      onClick={handleAdvance}
      disabled={loading}
      className={`h-7 px-2.5 text-[10px] text-white gap-1 rounded-lg shadow-sm transition-all duration-150 active:scale-[0.97] ${colorMap[nextStatus] || 'bg-indigo-650 hover:bg-indigo-700'}`}
      title={`Mark as ${nextStatus}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
      {nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}
    </Button>
  );
}

function StatCard({ icon: Icon, label, value, borderClass, bgClass, iconColorClass, isLoading }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border ${borderClass} rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5 group`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass} ${iconColorClass} shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-200`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{label}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-16 mt-0.5" />
        ) : (
          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5 truncate tracking-tight">{value}</p>
        )}
      </div>
    </div>
  );
}

function exportToCSV(rows) {
  const headers = ['SN','Date','Reference No','Raw Materials','RM Code','UOM','Supplier','Status','Grand Total','Payment Status'];
  const csvRows = [
    headers.join(','),
    ...rows.map((po, i) => {
      const rmNames = po.items && Array.isArray(po.items) && po.items.length > 0
        ? po.items.map(it => it.name || it.materialName).join(' + ')
        : po.name;
      return [
        i + 1,
        format(new Date(po.createdAt), 'dd-MM-yyyy'),
        po.referenceNo,
        `"${rmNames}"`,
        po.rmId,
        po.uomLabel || po.uom || '-',
        `"${po.supplierName || '-'}"`,
        po.status,
        Number(po.amount).toFixed(2),
        'Unpaid'
      ].join(',');
    })
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

export default function POListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState({ type: 'list', id: null });
  const [sortBy, setSortBy] = useState('recent');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const canChangeStatus = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const { data: pos = [], isLoading } = useQuery({
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

  const augmentedPos = pos.map(po => ({
    ...po,
    uomLabel: po.uom || '-'
  }));

  // Reset pagination to first page when search filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy]);

  if (view.type === 'create') {
    return <CreatePOPage onBack={() => setView({ type: 'list', id: null })} />;
  }
  if (view.type === 'edit') {
    return <EditPOPage id={view.id} onBack={() => setView({ type: 'list', id: null })} />;
  }

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
    if (sortBy === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'price_desc') return Number(b.amount || 0) - Number(a.amount || 0);
    if (sortBy === 'price_asc') return Number(a.amount || 0) - Number(b.amount || 0);
    if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });

  // Paginated PO list
  const totalPages = Math.ceil(sortedPOs.length / ITEMS_PER_PAGE);
  const paginatedPOs = sortedPOs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalAmount = augmentedPos.reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount = augmentedPos.filter(p => p.status === 'PENDING').length;
  const approvedCount = augmentedPos.filter(p => p.status === 'APPROVED').length;

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Page Header (Compact & Professional) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5.5 h-5.5 text-indigo-650 dark:text-indigo-400" />
            Purchase Orders
          </h1>
          <p className="text-xs text-slate-505 dark:text-slate-400">Manage and track raw material purchase orders.</p>
        </div>
        {['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
          <Button
            onClick={() => setView({ type: 'create', id: null })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all active:scale-[0.98] shadow-sm select-none"
          >
            <Plus className="w-4.5 h-4.5 text-white dark:text-slate-900" />
            Add Purchase
          </Button>
        )}
      </div>

      {/* Stat Cards Grid (Tighter & Compact) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Package} 
          label="Total POs" 
          value={augmentedPos.length} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-indigo-50/80 dark:bg-indigo-950/20" 
          iconColorClass="text-indigo-600 dark:text-indigo-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={Clock} 
          label="Pending" 
          value={pendingCount} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-amber-50/80 dark:bg-amber-950/20" 
          iconColorClass="text-amber-600 dark:text-amber-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={CheckCircle2} 
          label="Approved" 
          value={approvedCount} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-emerald-50/80 dark:bg-emerald-950/20" 
          iconColorClass="text-emerald-600 dark:text-emerald-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={TrendingUp} 
          label="Total Value" 
          value={`₹${(totalAmount/1000).toFixed(1)}K`} 
          borderClass="border-slate-200/60 dark:border-slate-800/60" 
          bgClass="bg-purple-50/80 dark:bg-purple-950/20" 
          iconColorClass="text-purple-650 dark:text-purple-400" 
          isLoading={isLoading}
        />
      </div>

      {/* Table & List Card Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Toolbar (Compact height) */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <div className="flex flex-col gap-3">
            {/* Top Row: Search */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search PO, RM Code, Supplier..."
                className="pl-10 h-9 w-full text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Bottom Row: Filter & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Filter Section */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-850">
                  <span className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                    <Filter className="w-3 h-3 text-slate-450" /> Filter
                  </span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="h-7 text-xs border-none bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-0 font-bold pr-5 cursor-pointer"
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
                  className="w-full sm:w-auto h-9 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  className="h-8 px-3 text-[11px] font-semibold gap-1.5 text-emerald-750 bg-emerald-50/20 hover:bg-emerald-100/40 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/10 dark:border-emerald-900/20 rounded-xl transition-all"
                  onClick={() => exportToCSV(filteredPOs)}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 
                  <span>Excel</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-8 px-3 text-[11px] font-semibold gap-1.5 text-rose-700 bg-rose-50/20 hover:bg-rose-100/40 border-rose-200 dark:text-rose-400 dark:bg-rose-955/10 dark:border-rose-900/20 rounded-xl transition-all"
                  onClick={() => exportToPDF(filteredPOs)}
                >
                  <Download className="w-3.5 h-3.5" /> 
                  <span>PDF</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-8 px-3 text-[11px] font-semibold gap-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-205 dark:text-slate-400 dark:bg-slate-950 dark:border-slate-800 rounded-xl transition-all"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5" /> 
                  <span>Print</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop View Table (Tight rows + Paginated) */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/60 dark:bg-slate-800/30">
              <TableRow className="border-b border-slate-200 dark:border-slate-800">
                <TableHead className="w-12 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">SN</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ref No</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Raw Material</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">UOM</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Supplier</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Purchase Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Grand Total</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Paid</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Payment</TableHead>
                <TableHead className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100 dark:border-slate-800">
                    {Array.from({ length: 12 }).map((__, j) => (
                      <TableCell key={j} className="py-2.5"><Skeleton className="h-4.5 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">No purchase orders found</p>
                      <p className="text-xs text-slate-550">Try adjusting your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPOs.map((po, idx) => (
                  <TableRow key={po.id} className="group hover:bg-slate-50/40 dark:hover:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 transition-colors">
                    <TableCell className="text-center font-bold text-slate-400 text-[11px] py-2.5">
                      {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                    </TableCell>
                    <TableCell className="text-[11px] text-slate-650 dark:text-slate-350 font-medium whitespace-nowrap py-2.5">{format(new Date(po.createdAt), 'dd-MM-yyyy')}</TableCell>
                    <TableCell className="py-2.5">
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="font-mono font-bold text-indigo-650 dark:text-indigo-400 text-[11px] hover:underline"
                      >
                        {po.referenceNo}
                      </button>
                    </TableCell>
                    <TableCell className="py-2.5 min-w-[220px]">
                      {po.items && Array.isArray(po.items) && po.items.length > 1 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {po.items[0].name || po.items[0].materialName || po.name}
                          </span>
                          <span className="font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shrink-0">
                            +{po.items.length - 1} items
                          </span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-200 text-xs">
                            {po.items && po.items.length === 1 ? (po.items[0].name || po.items[0].materialName) : po.name}
                          </div>
                          <div className="text-[9px] text-slate-450 dark:text-slate-500 font-mono">{po.rmId}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {po.items && Array.isArray(po.items) && po.items.length > 1 ? (
                        <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          Multi-UOM
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-450 px-2 py-0.5 rounded border border-slate-200/50">
                          {po.uomLabel || po.uom || '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 dark:text-slate-350 font-semibold py-2.5">{po.supplierName || '-'}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusChip status={po.status} />
                        {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                          <StatusAdvanceButton po={po} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-slate-850 dark:text-slate-100 font-mono py-2.5">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-500 font-bold text-xs font-mono py-2.5">₹0.00</TableCell>
                    <TableCell className="text-right text-rose-500 dark:text-rose-455 font-black text-xs font-mono py-2.5">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/40">
                        Unpaid
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
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
                            onClick={() => setView({ type: 'edit', id: po.id })}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-655 dark:hover:text-blue-450 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-650 dark:hover:text-rose-455 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-sm font-bold text-slate-900 dark:text-white">Delete Purchase Order?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-550 dark:text-slate-400 text-xs">
                                  Are you sure you want to delete PO <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{po.referenceNo}</span>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="rounded-xl border border-slate-200 text-xs">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(po.id)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs"
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

        {/* Mobile View Card List (Paginated) */}
        <div className="md:hidden p-3 space-y-3 bg-slate-50/50 dark:bg-slate-955/20">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="pt-1 flex justify-between gap-2">
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-7 w-20" />
                </div>
              </div>
            ))
          ) : paginatedPOs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-xl p-6 text-center">
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">No purchase orders found</p>
            </div>
          ) : (
            paginatedPOs.map((po) => (
              <div 
                key={po.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-xl p-4 shadow-sm hover:shadow transition-all duration-200 space-y-3"
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <button
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline block text-left"
                    >
                      {po.referenceNo}
                    </button>
                    <div className="text-[9px] text-slate-400 dark:text-slate-505 font-bold">
                      {format(new Date(po.createdAt), 'dd MMM yyyy')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip status={po.status} />
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100">
                      Unpaid
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="pt-2 pb-2 border-t border-slate-100 dark:border-slate-800/85 grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-0.5">
                      Raw Material
                    </span>
                    {po.items && Array.isArray(po.items) && po.items.length > 1 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                          {po.items[0].name || po.items[0].materialName || po.name}
                        </span>
                        <span className="font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 shrink-0">
                          +{po.items.length - 1} items
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate" title={po.name}>
                          {po.items && po.items.length === 1 ? (po.items[0].name || po.items[0].materialName) : po.name}
                        </div>
                        <div className="text-[9px] text-slate-450 font-mono">
                          {po.rmId}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-0.5">
                      Supplier
                    </span>
                    <div className="text-slate-700 dark:text-slate-300 font-bold truncate" title={po.supplierName}>
                      {po.supplierName || '-'}
                    </div>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl grid grid-cols-3 gap-1.5 text-center text-[10px] border border-slate-100 dark:border-slate-800/40">
                  <div>
                    <span className="block text-[8px] text-slate-400 dark:text-slate-500 mb-0.5">Grand Total</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-400 dark:text-slate-500 mb-0.5">Paid</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-500 font-mono">₹0.0</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-400 dark:text-slate-500 mb-0.5">Due</span>
                    <span className="font-bold text-rose-500 dark:text-rose-455 font-mono">
                      ₹{Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5">
                  <div>
                    {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                      <StatusAdvanceButton po={po} />
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="h-8 px-2 text-[10px] font-semibold text-slate-655 border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50"
                    >
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setView({ type: 'edit', id: po.id })}
                          className="h-8 px-2 text-[10px] font-semibold text-blue-655 border-blue-200/50 rounded-lg hover:bg-blue-50"
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-[10px] font-semibold text-rose-650 border-rose-200/50 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-sm font-bold text-slate-900 dark:text-white">Delete Purchase Order?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-550 dark:text-slate-400 text-xs">
                                Are you sure you want to delete PO <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{po.referenceNo}</span>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="rounded-xl border border-slate-200 text-xs">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(po.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs"
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

        {/* Footer info & Pagination block */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedPOs.length)} of {sortedPOs.length} POs
          </div>

          <div className="order-1 sm:order-2">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>

          <div className="text-xs font-bold text-slate-800 dark:text-slate-250 bg-slate-100/50 dark:bg-slate-950 px-3 py-1 rounded-lg border border-slate-200/50 dark:border-slate-850 order-3">
            Total Value: ₹{filteredPOs.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}

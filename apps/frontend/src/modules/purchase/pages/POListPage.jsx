import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import {
  Plus, Search, Eye, Edit, Trash2, ChevronRight, ChevronLeft,
  CheckCircle2, Clock, Package, TrendingUp, AlertCircle, FileText,
  Filter, RotateCcw, X, CreditCard, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const STATUS_ORDER = ['PENDING', 'ORDERED', 'RECEIVED'];
const STATUS_LABELS = {
  PENDING: 'Pending',
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
};

function StatusChip({ status }) {
  let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  if (status === 'APPROVED' || status === 'RECEIVED') {
    badgeColor = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  } else if (status === 'ORDERED' || status === 'IN_PROGRESS') {
    badgeColor = 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
  } else if (status === 'PENDING') {
    badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  } else if (status === 'REJECTED' || status === 'CANCELLED') {
    badgeColor = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
  }

  return (
    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-lg border ${badgeColor}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatusAdvanceButton({ po }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const currentIdx = STATUS_ORDER.indexOf(po.status);
  if (currentIdx === -1 || currentIdx >= STATUS_ORDER.length - 1) return null;

  const nextStatus = STATUS_ORDER[currentIdx + 1];

  const handleAdvance = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.patch(`/grn/po/${po.id}/status`, { status: nextStatus });
      queryClient.invalidateQueries({ queryKey: ['pos'] });
    } catch (err) {
      console.error('Failed to advance PO status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAdvance}
      disabled={loading}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 transition-all cursor-pointer disabled:opacity-50 shrink-0"
      title={`Advance to ${STATUS_LABELS[nextStatus]}`}
    >
      <span>{STATUS_LABELS[nextStatus]}</span>
      <ChevronRight className="w-2.5 h-2.5" />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, borderClass, bgClass, iconColorClass, isLoading }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-xs flex items-center gap-3.5 transition-all duration-200 hover:-translate-y-0.5 ${borderClass}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}>
        <Icon className={`w-5.5 h-5.5 ${iconColorClass}`} />
      </div>
      <div className="space-y-0.5 min-w-0">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-16 rounded" />
        ) : (
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

function PaymentStatusDropdown({ po, onUpdate }) {
  const [updating, setUpdating] = useState(false);
  const total = Number(po.totalAmount || po.amount || 0);
  const currentStatus = po.paymentStatus || (Number(po.paidAmount) >= total && total > 0 ? 'PAID' : Number(po.paidAmount) > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

  const handleSelect = async (newStatus) => {
    let amt = Number(po.paidAmount || 0);
    if (newStatus === 'PAID') {
      amt = total;
    } else if (newStatus === 'UNPAID') {
      amt = 0;
    } else if (newStatus === 'PARTIALLY_PAID') {
      const inputVal = window.prompt(`Enter paid amount for PO ${po.referenceNo} (Total: ₹${total.toLocaleString('en-IN')}):`, (total / 2).toString());
      if (inputVal === null) return;
      amt = parseFloat(inputVal) || 0;
    }

    setUpdating(true);
    try {
      await api.patch(`/rm/po/${po.id}/payment`, {
        paymentStatus: newStatus,
        paidAmount: amt
      });
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Payment status updated to ${newStatus === 'PAID' ? 'PAID' : newStatus === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : 'UNPAID'} (Paid: ₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`,
        showConfirmButton: false,
        timer: 2500
      });
      onUpdate();
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'Failed to update payment status' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative inline-block" onClick={e => e.stopPropagation()}>
      <select
        value={currentStatus}
        disabled={updating}
        onChange={(e) => handleSelect(e.target.value)}
        className={`px-2 py-1 text-[10px] font-black rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none transition-all shadow-xs ${
          currentStatus === 'PAID'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            : currentStatus === 'PARTIALLY_PAID'
            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }`}
      >
        <option value="UNPAID" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold">🔴 UNPAID</option>
        <option value="PARTIALLY_PAID" className="bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold">🔵 PARTIAL</option>
        <option value="PAID" className="bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold">🟢 PAID</option>
      </select>
    </div>
  );
}

export default function POListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [view, setView] = useState({ type: 'list', id: null });
  const [sortBy, setSortBy] = useState('recent');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const canChangeStatus = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  const { data: pos = [], isLoading, refetch } = useQuery({
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

  const augmentedPos = pos.map(po => {
    const total = Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount || 0);
    const paid = Number(po.paidAmount !== undefined && po.paidAmount !== null ? po.paidAmount : (po.paymentStatus === 'PAID' ? total : 0));
    const due = Math.max(0, total - paid);
    const pStatus = po.paymentStatus || (paid >= total && total > 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    return {
      ...po,
      totalAmount: total,
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: pStatus,
      uomLabel: po.uom || '-'
    };
  });

  // Reset pagination to first page when search filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentFilter, sortBy]);

  const filteredPOs = augmentedPos.filter(po => {
    const matchesSearch = 
      po.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.rmId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    const matchesPayment = paymentFilter === 'ALL' || po.paymentStatus === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const sortedPOs = [...filteredPOs].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'price_desc') return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
    if (sortBy === 'price_asc') return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
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

  const totalAmount = augmentedPos.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const totalPaid = augmentedPos.reduce((s, p) => s + Number(p.paidAmount || 0), 0);
  const pendingCount = augmentedPos.filter(p => p.status === 'PENDING').length;

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      <DashboardBackButton />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5.5 h-5.5 text-indigo-600 dark:text-indigo-400" />
            Purchase Orders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage and track raw material purchase orders & payments.</p>
        </div>
        {['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
          <Button
            onClick={() => setView({ type: 'create', id: null })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-all active:scale-[0.98] shadow-xs select-none cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5 text-white dark:text-slate-900" />
            Add Purchase
          </Button>
        )}
      </div>

      {/* Stat Cards Grid */}
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
          label="Total Paid" 
          value={`₹${(totalPaid/1000).toFixed(1)}K`} 
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
          iconColorClass="text-purple-600 dark:text-purple-400" 
          isLoading={isLoading}
        />
      </div>

      {/* Table & List Card Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
          <div className="flex flex-col gap-3">
            {/* Top Row: Search Bar (Theme-aware bg) */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search PO, RM Code, Supplier..."
                className="pl-10 h-9.5 w-full text-xs bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl shadow-xs transition-colors"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Bottom Row: Filters & Sort */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <div className="flex items-center gap-2 bg-slate-100/70 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                    <Filter className="w-3 h-3 text-slate-400" /> Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">All Statuses</option>
                    <option value="PENDING" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Pending</option>
                    <option value="ORDERED" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Ordered</option>
                    <option value="RECEIVED" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Received</option>
                    <option value="APPROVED" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Approved</option>
                    <option value="REJECTED" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Rejected</option>
                  </select>
                </div>

                {/* Payment Status Filter */}
                <div className="flex items-center gap-2 bg-slate-100/70 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                    <CreditCard className="w-3 h-3 text-slate-400" /> Payment
                  </span>
                  <select
                    value={paymentFilter}
                    onChange={e => setPaymentFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">All Payments</option>
                    <option value="PAID" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Paid</option>
                    <option value="PARTIALLY_PAID" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Partially Paid</option>
                    <option value="UNPAID" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Unpaid</option>
                  </select>
                </div>

                {(searchTerm || statusFilter !== 'ALL' || paymentFilter !== 'ALL') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); setPaymentFilter('ALL'); }}
                    className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SortSelect value={sortBy} onChange={setSortBy} options={[
                  { value: 'recent', label: 'Most Recent' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'price_desc', label: 'Total: High to Low' },
                  { value: 'price_asc', label: 'Total: Low to High' },
                  { value: 'name_asc', label: 'Name: A-Z' },
                  { value: 'name_desc', label: 'Name: Z-A' }
                ]} />
              </div>
            </div>
          </div>
        </div>

        {/* PO Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800">
              <TableRow>
                <TableHead className="w-12 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">SN</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Reference</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Raw Material</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">UOM</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Supplier</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Purchase Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Grand Total</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Paid Amount</TableHead>
                <TableHead className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Amount</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Payment Status</TableHead>
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
                      <p className="text-xs text-slate-500">Try adjusting your search or filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPOs.map((po, idx) => (
                  <TableRow key={po.id} className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/80 transition-colors">
                    <TableCell className="text-center font-bold text-slate-400 text-[11px] py-2.5">
                      {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                    </TableCell>
                    <TableCell className="text-[11px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap py-2.5">{format(new Date(po.createdAt), 'dd-MM-yyyy')}</TableCell>
                    <TableCell className="py-2.5">
                      <button
                        onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px] hover:underline cursor-pointer"
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
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{po.rmId}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {po.items && Array.isArray(po.items) && po.items.length > 1 ? (
                        <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          Multi-UOM
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200/50">
                          {po.uomLabel || po.uom || '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-semibold py-2.5">{po.supplierName || '-'}</TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusChip status={po.status} />
                        {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                          <StatusAdvanceButton po={po} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-slate-900 dark:text-slate-100 font-mono py-2.5">
                      ₹{Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono py-2.5">
                      ₹{Number(po.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-rose-500 dark:text-rose-400 font-black text-xs font-mono py-2.5">
                      ₹{Number(po.dueAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <PaymentStatusDropdown po={po} onUpdate={refetch} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {po.status === 'PENDING' && ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role) && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => setView({ type: 'edit', id: po.id })}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-slate-900 dark:text-white">Delete Purchase Order?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
                                  Are you sure you want to delete PO <strong className="text-slate-800 dark:text-slate-200 font-mono">{po.referenceNo}</strong>? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(po.id)}
                                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
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

        {/* Pagination Footer */}
        {sortedPOs.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedPOs.length)} of {sortedPOs.length} POs
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

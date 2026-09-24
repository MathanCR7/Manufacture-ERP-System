import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import {
  Plus, Search, Eye, Edit, Trash2, ChevronRight, ChevronDown,
  CheckCircle2, Clock, Package, TrendingUp, AlertCircle, FileText,
  RotateCcw, X, CreditCard, Loader2, ArrowUpDown, ArrowUp, ArrowDown
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
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

const STATUS_ORDER = ['PENDING', 'ORDERED', 'RECEIVED'];
const STATUS_LABELS = {
  PENDING: 'Draft',
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
};

function StatusChip({ status }) {
  let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  if (status === 'APPROVED' || status === 'RECEIVED') {
    badgeColor = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  } else if (status === 'ORDERED' || status === 'IN_PROGRESS') {
    badgeColor = 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
  } else if (status === 'PENDING') {
    badgeColor = 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
  } else if (status === 'REJECTED' || status === 'CANCELLED') {
    badgeColor = 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9.5px] font-extrabold rounded-md border uppercase tracking-wider ${badgeColor}`}>
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
      queryClient.invalidateQueries({ queryKey: ['upcoming-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-lab-tests'] });
    } catch (err) {
      console.error('Failed to advance PO status:', err);
    } finally {
      setLoading(false);
    }
  };

  const actionTitle = nextStatus === 'ORDERED' 
    ? 'Advance to Ordered (makes order visible in Upcoming Deliveries)'
    : 'Mark as Received (auto-routes to Lab Test or updates Inventory Stock)';

  const actionText = nextStatus === 'ORDERED' ? 'Order' : 'Receive';

  return (
    <button
      onClick={handleAdvance}
      disabled={loading}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 transition-all cursor-pointer disabled:opacity-50 shrink-0"
      title={actionTitle}
    >
      <span>{actionText}</span>
      <ChevronRight className="w-2.5 h-2.5" />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, borderClass, bgClass, iconColorClass, isLoading }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border p-3 shadow-2xs flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 ${borderClass}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
        <Icon className={`w-4.5 h-4.5 ${iconColorClass}`} />
      </div>
      <div className="space-y-0.5 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
        {isLoading ? (
          <Skeleton className="h-5 w-16 rounded" />
        ) : (
          <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

function PaymentUpdateModal({ po, onClose, onUpdated }) {
  const total = Number(po.totalAmount || po.amount || 0);
  const initialPaid = Number(po.paidAmount !== undefined && po.paidAmount !== null ? po.paidAmount : (po.paymentStatus === 'PAID' ? total : 0));

  const [paidInput, setPaidInput] = useState(initialPaid.toString());
  const [paymentStatusMode, setPaymentStatusMode] = useState(
    po.paymentStatus || (initialPaid >= total && total > 0 ? 'PAID' : initialPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const numPaid = parseFloat(paidInput) || 0;
  const numDue = Math.max(0, total - numPaid);

  const handleAmountChange = (val) => {
    setPaidInput(val);
    setError('');
    const parsed = parseFloat(val) || 0;
    if (parsed <= 0) {
      setPaymentStatusMode('UNPAID');
    } else if (parsed >= total) {
      setPaymentStatusMode('PAID');
    } else {
      setPaymentStatusMode('PARTIALLY_PAID');
    }
  };

  const handleSetPreset = (percentage) => {
    setError('');
    let calculated = (total * percentage) / 100;
    calculated = Math.round(calculated * 100) / 100;
    setPaidInput(calculated.toString());
    if (percentage === 0) setPaymentStatusMode('UNPAID');
    else if (percentage === 100) setPaymentStatusMode('PAID');
    else setPaymentStatusMode('PARTIALLY_PAID');
  };

  const handleSelectMode = (mode) => {
    setPaymentStatusMode(mode);
    setError('');
    if (mode === 'UNPAID') {
      setPaidInput('0');
    } else if (mode === 'PAID') {
      setPaidInput(total.toString());
    } else if (mode === 'PARTIALLY_PAID') {
      if (numPaid <= 0 || numPaid >= total) {
        setPaidInput((Math.round((total / 2) * 100) / 100).toString());
      }
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const finalPaid = parseFloat(paidInput);
    if (isNaN(finalPaid) || finalPaid < 0) {
      setError('Please enter a valid paid amount (cannot be negative).');
      return;
    }
    if (finalPaid > total) {
      setError(`Paid amount cannot exceed the Grand Total (₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}).`);
      return;
    }

    let resolvedStatus = paymentStatusMode;
    if (finalPaid === 0) resolvedStatus = 'UNPAID';
    else if (finalPaid >= total) resolvedStatus = 'PAID';
    else resolvedStatus = 'PARTIALLY_PAID';

    setIsSubmitting(true);
    try {
      await api.patch(`/rm/po/${po.id}/payment`, {
        paymentStatus: resolvedStatus,
        paidAmount: finalPaid
      });

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Payment Updated for ${po.referenceNo}`,
        html: `<span class="text-xs">Status: <b>${resolvedStatus}</b> · Paid: <b>₹${finalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>`,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });

      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update payment status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">Update Payment</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {po.referenceNo}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Supplier: <span className="font-semibold text-slate-700 dark:text-slate-300">{po.supplierName || po.supplier?.name || 'N/A'}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Total Amount</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
                ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Paid Amount</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                ₹{numPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Due Amount</span>
              <span className="text-sm sm:text-base font-extrabold font-mono text-rose-700 dark:text-rose-300 mt-0.5 block">
                ₹{numDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Payment Status Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => handleSelectMode('UNPAID')}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  paymentStatusMode === 'UNPAID'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs ring-1 ring-amber-400/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🔴</span>
                <span>Unpaid</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode('PARTIALLY_PAID')}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  paymentStatusMode === 'PARTIALLY_PAID'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs ring-1 ring-indigo-400/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🔵</span>
                <span>Partial</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode('PAID')}
                className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  paymentStatusMode === 'PAID'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-400/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🟢</span>
                <span>Full Paid</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                Paid Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                Max: ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-sm">
                ₹
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={total}
                value={paidInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="pl-8 text-base font-extrabold font-mono rounded-xl h-11 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-500"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Fill:</span>
              <button
                type="button"
                onClick={() => handleSetPreset(0)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                0%
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(25)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                25% (₹{(total * 0.25).toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(50)}
                className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
              >
                50% Half (₹{(total * 0.5).toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(75)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                75% (₹{(total * 0.75).toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset(100)}
                className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
              >
                100% Full
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Save Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentStatusDropdown({ po, onUpdate, onOpenModal }) {
  const [updating, setUpdating] = useState(false);
  const total = Number(po.totalAmount || po.amount || 0);
  const currentStatus = po.paymentStatus || (Number(po.paidAmount) >= total && total > 0 ? 'PAID' : Number(po.paidAmount) > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

  const handleSelect = async (newStatus) => {
    if (newStatus === 'PARTIALLY_PAID') {
      if (onOpenModal) onOpenModal(po);
      return;
    }

    let amt = Number(po.paidAmount || 0);
    if (newStatus === 'PAID') {
      amt = total;
    } else if (newStatus === 'UNPAID') {
      amt = 0;
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
        title: `Payment status updated to ${newStatus === 'PAID' ? 'PAID' : 'UNPAID'} (Paid: ₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`,
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
        className={`px-1.5 py-0.5 text-[9.5px] font-extrabold rounded-md border appearance-none pr-5 cursor-pointer focus:outline-none transition-all shadow-3xs ${
          currentStatus === 'PAID'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            : currentStatus === 'PARTIALLY_PAID'
            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }`}
      >
        <option value="UNPAID" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold">UNPAID</option>
        <option value="PARTIALLY_PAID" className="bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold">PARTIAL</option>
        <option value="PAID" className="bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold">PAID</option>
      </select>
      <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export default function POListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [paymentModalPO, setPaymentModalPO] = useState(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canChangeStatus = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);
  const canAddPurchase = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

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

  const augmentedPos = useMemo(() => {
    return (pos || []).map(po => {
      const total = Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount || 0);
      const paid = Number(po.paidAmount !== undefined && po.paidAmount !== null ? po.paidAmount : (po.paymentStatus === 'PAID' ? total : 0));
      const due = Math.max(0, total - paid);
      const pStatus = po.paymentStatus || (paid >= total && total > 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

      return {
        ...po,
        totalAmount: total,
        paidAmount: paid,
        dueAmount: due,
        paymentStatus: pStatus
      };
    });
  }, [pos]);

  // Reset pagination to first page when search filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentFilter, sortBy]);

  // Filter Logic
  const filteredPOs = useMemo(() => {
    return augmentedPos.filter(po => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || (
        (po.referenceNo || '').toLowerCase().includes(term) ||
        (po.rmId || '').toLowerCase().includes(term) ||
        (po.name || '').toLowerCase().includes(term) ||
        (po.supplierName || po.supplier?.name || '').toLowerCase().includes(term) ||
        (po.supplierInvoiceNo || '').toLowerCase().includes(term) ||
        (po.ewayBillNo || '').toLowerCase().includes(term) ||
        (po.vehicleNumber || '').toLowerCase().includes(term) ||
        (po.items && Array.isArray(po.items) && po.items.some(it => (it.name || it.materialName || '').toLowerCase().includes(term)))
      );

      const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
      const matchesPayment = paymentFilter === 'ALL' || po.paymentStatus === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [augmentedPos, searchTerm, statusFilter, paymentFilter]);

  // Sort Logic (Just like /setup/raw-material)
  const sortedPOs = useMemo(() => {
    let list = [...filteredPOs];
    list.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sortBy === 'ref_asc') return (a.referenceNo || '').localeCompare(b.referenceNo || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'ref_desc') return (b.referenceNo || '').localeCompare(a.referenceNo || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'supplier_asc') {
        const sA = a.supplierName || a.supplier?.name || '';
        const sB = b.supplierName || b.supplier?.name || '';
        return sA.localeCompare(sB, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'supplier_desc') {
        const sA = a.supplierName || a.supplier?.name || '';
        const sB = b.supplierName || b.supplier?.name || '';
        return sB.localeCompare(sA, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'total_desc') return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      if (sortBy === 'total_asc') return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      if (sortBy === 'due_desc') return Number(b.dueAmount || 0) - Number(a.dueAmount || 0);
      if (sortBy === 'due_asc') return Number(a.dueAmount || 0) - Number(b.dueAmount || 0);
      return 0;
    });
    return list;
  }, [filteredPOs, sortBy]);

  // Paginated PO list
  const totalPages = Math.ceil(sortedPOs.length / itemsPerPage) || 1;
  const paginatedPOs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedPOs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedPOs, currentPage, itemsPerPage]);

  const totalAmount = augmentedPos.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const totalPaid = augmentedPos.reduce((s, p) => s + Number(p.paidAmount || 0), 0);
  const pendingCount = augmentedPos.filter(p => p.status === 'PENDING').length;

  const isFilterActive = searchTerm !== '' || statusFilter !== 'ALL' || paymentFilter !== 'ALL' || sortBy !== 'recent';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setSortBy('recent');
    setCurrentPage(1);
  };

  // Header quick sort toggles
  const handleToggleSortDate = () => {
    setSortBy(prev => (prev === 'recent' ? 'oldest' : 'recent'));
    setCurrentPage(1);
  };

  const handleToggleSortRef = () => {
    setSortBy(prev => (prev === 'ref_asc' ? 'ref_desc' : 'ref_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortSupplier = () => {
    setSortBy(prev => (prev === 'supplier_asc' ? 'supplier_desc' : 'supplier_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortTotal = () => {
    setSortBy(prev => (prev === 'total_desc' ? 'total_asc' : 'total_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortDue = () => {
    setSortBy(prev => (prev === 'due_desc' ? 'due_asc' : 'due_desc'));
    setCurrentPage(1);
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      <DashboardBackButton />
      
      {/* Sleek Compact Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Purchase Orders
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {pos.length} {pos.length === 1 ? 'PO' : 'POs'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Manage and audit raw material procurement, vendor billing, and payment settlements.
            </p>
          </div>
        </div>

        {canAddPurchase && (
          <Button
            onClick={() => navigate('/purchase-orders/create')}
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Purchase
          </Button>
        )}
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard 
          icon={Package} 
          label="Total POs" 
          value={augmentedPos.length} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-indigo-50/80 dark:bg-indigo-950/30" 
          iconColorClass="text-indigo-600 dark:text-indigo-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={Clock} 
          label="Pending / Draft" 
          value={pendingCount} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-amber-50/80 dark:bg-amber-950/30" 
          iconColorClass="text-amber-600 dark:text-amber-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={CheckCircle2} 
          label="Total Paid" 
          value={`₹${(totalPaid/1000).toFixed(1)}K`} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-emerald-50/80 dark:bg-emerald-950/30" 
          iconColorClass="text-emerald-600 dark:text-emerald-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={TrendingUp} 
          label="Total Value" 
          value={`₹${(totalAmount/1000).toFixed(1)}K`} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-purple-50/80 dark:bg-purple-950/30" 
          iconColorClass="text-purple-600 dark:text-purple-400" 
          isLoading={isLoading}
        />
      </div>

      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar (Matched with /setup/raw-material & Suppliers) */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            {/* Search Input with quick clear */}
            <div className="relative w-full md:w-64 lg:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO, supplier, material, invoice, eway..."
                value={searchTerm}
                onChange={(e) => { 
                  setSearchTerm(e.target.value); 
                  setCurrentPage(1); 
                }}
                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden lg:inline-flex items-center gap-1">
                  <span>Found {sortedPOs.length} matches</span>
                </div>
              )}

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Status: All</option>
                  <option value="PENDING">Draft</option>
                  <option value="ORDERED">Ordered</option>
                  <option value="RECEIVED">Received</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Payment Filter */}
              <div className="relative">
                <select
                  value={paymentFilter}
                  onChange={(e) => {
                    setPaymentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Payment: All</option>
                  <option value="PAID">Paid Only</option>
                  <option value="PARTIALLY_PAID">Partial</option>
                  <option value="UNPAID">Unpaid Only</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Sort Dropdown (Styled identically to /setup/raw-material) */}
              <div className="relative flex items-center">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-indigo-600 dark:text-indigo-400">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-8 pr-7 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Sort options"
                >
                  <option value="recent">Sort: Date (Newest First)</option>
                  <option value="oldest">Sort: Date (Oldest First)</option>
                  <option value="ref_asc">Sort: PO Ref (A → Z)</option>
                  <option value="ref_desc">Sort: PO Ref (Z → A)</option>
                  <option value="supplier_asc">Sort: Supplier (A → Z)</option>
                  <option value="supplier_desc">Sort: Supplier (Z → A)</option>
                  <option value="total_desc">Sort: Grand Total (High to Low)</option>
                  <option value="total_asc">Sort: Grand Total (Low to High)</option>
                  <option value="due_desc">Sort: Due Amount (High to Low)</option>
                  <option value="due_asc">Sort: Due Amount (Low to High)</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Quick Reset */}
              {isFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer shadow-3xs"
                  title="Reset filters and sort"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Table: Exact column structure requested with NO UOM column */}
          {/* Order: SN -> Date -> PO -> Supplier -> Raw Materials -> Purchase Status -> Grand Total -> Paid Amount -> Due Amount -> Payment Status -> Action */}
          <div className="w-full overflow-x-auto lg:overflow-x-hidden">
            <Table className="w-full table-fixed text-xs border-collapse">
              <TableHeader className="bg-slate-50/90 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 select-none">
                <TableRow className="dark:border-slate-800">
                  {/* 1. SN: 3.5% */}
                  <TableHead className="py-2 px-1 text-center text-[10px] uppercase tracking-wider font-extrabold w-[3.5%] min-w-[32px]">
                    SN
                  </TableHead>

                  {/* 2. Date: 7.5% */}
                  <TableHead 
                    onClick={handleToggleSortDate}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[7.5%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>Date</span>
                      {sortBy === 'oldest' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'recent' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 3. PO Reference: 12% */}
                  <TableHead 
                    onClick={handleToggleSortRef}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[12%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>PO Ref</span>
                      {sortBy === 'ref_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'ref_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 4. Supplier: 13% */}
                  {/* 4. Supplier: 20% */}
                  <TableHead 
                    onClick={handleToggleSortSupplier}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[20%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>Supplier</span>
                      {sortBy === 'supplier_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'supplier_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 5. Purchase Status: 11% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[11%]">
                    <div className="truncate">Purchase Status</div>
                  </TableHead>

                  {/* 7. Grand Total: 8.5% */}
                  <TableHead 
                    onClick={handleToggleSortTotal}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[8.5%]"
                  >
                    <div className="flex items-center justify-end gap-1 truncate">
                      <span>Grand Total</span>
                      {sortBy === 'total_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'total_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 8. Paid Amount: 8.5% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-right w-[8.5%]">
                    <div className="truncate">Paid Amount</div>
                  </TableHead>

                  {/* 9. Due Amount: 8.5% */}
                  <TableHead 
                    onClick={handleToggleSortDue}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[8.5%]"
                  >
                    <div className="flex items-center justify-end gap-1 truncate">
                      <span>Due Amount</span>
                      {sortBy === 'due_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'due_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 10. Payment Status: 8% */}
                  <TableHead className="py-2 px-1 text-[10px] uppercase tracking-wider font-extrabold text-center w-[8%]">
                    <div className="truncate">Payment Status</div>
                  </TableHead>

                  {/* 11. Action: 4% (min-w 65px) */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-center w-[4%] min-w-[65px]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-100 dark:border-slate-800">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <TableCell key={j} className="py-2 px-2"><Skeleton className="h-4.5 w-full rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedPOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-44 text-center py-10 text-slate-400 dark:text-slate-500 font-medium">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileText className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No purchase orders found</p>
                        <p className="text-[11px] text-slate-400">Try adjusting your search or filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPOs.map((po, idx) => {
                    const computedIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <TableRow 
                        key={po.id} 
                        className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* 1. SN */}
                        <TableCell className="py-2 px-1 text-center font-bold text-slate-400 text-[10px] select-none truncate">
                          {computedIdx}
                        </TableCell>

                        {/* 2. Date */}
                        <TableCell className="py-2 px-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate" title={po.createdAt ? format(new Date(po.createdAt), 'dd-MM-yyyy') : '—'}>
                          <span className="truncate block font-mono">
                            {po.createdAt ? format(new Date(po.createdAt), 'dd-MM-yyyy') : '—'}
                          </span>
                        </TableCell>

                        {/* 3. PO Reference */}
                        <TableCell className="py-2 px-2 text-xs truncate">
                          <button
                            onClick={() => navigate(`/purchase-orders/${po.id}`)}
                            className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer block truncate text-left"
                            title={`View ${po.referenceNo}`}
                          >
                            {po.referenceNo}
                          </button>
                          {(po.supplierInvoiceNo || po.ewayBillNo) && (
                            <div className="flex items-center gap-1 mt-0.5 truncate">
                              {po.supplierInvoiceNo && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 truncate" title={`Invoice: ${po.supplierInvoiceNo}`}>
                                  Inv: {po.supplierInvoiceNo}
                                </span>
                              )}
                              {po.ewayBillNo && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 shrink-0" title={`E-Way: ${po.ewayBillNo}`}>
                                  E-Way
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* 4. Supplier */}
                        <TableCell className="py-2 px-2 text-[11px] text-slate-700 dark:text-slate-300 font-semibold truncate" title={po.supplierName || po.supplier?.name || '—'}>
                          <span className="truncate block">
                            {po.supplierName || po.supplier?.name || '—'}
                          </span>
                        </TableCell>

                        {/* 5. Purchase Status */}
                        <TableCell className="py-2 px-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            <StatusChip status={po.status} />
                            {canChangeStatus && ['PENDING', 'ORDERED'].includes(po.status) && (
                              <StatusAdvanceButton po={po} />
                            )}
                          </div>
                        </TableCell>

                        {/* 7. Grand Total */}
                        <TableCell className="py-2 px-2 text-right font-bold text-slate-900 dark:text-slate-100 font-mono text-[11px] truncate">
                          ₹{Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        {/* 8. Paid Amount */}
                        <TableCell 
                          className="py-2 px-2 text-right cursor-pointer group/paid hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors truncate"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModalPO(po);
                          }}
                          title="Click to update payment"
                        >
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] font-mono group-hover/paid:underline inline-flex items-center justify-end gap-1">
                            ₹{Number(po.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <Edit className="w-2.5 h-2.5 opacity-0 group-hover/paid:opacity-100 transition-opacity text-emerald-600 dark:text-emerald-400" />
                          </span>
                        </TableCell>

                        {/* 9. Due Amount */}
                        <TableCell 
                          className="py-2 px-2 text-right cursor-pointer group/due hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors truncate"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModalPO(po);
                          }}
                          title="Click to update payment"
                        >
                          <span className="text-rose-500 dark:text-rose-400 font-black text-[11px] font-mono group-hover/due:underline inline-flex items-center justify-end gap-1">
                            ₹{Number(po.dueAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <Edit className="w-2.5 h-2.5 opacity-0 group-hover/due:opacity-100 transition-opacity text-rose-500 dark:text-rose-400" />
                          </span>
                        </TableCell>

                        {/* 10. Payment Status */}
                        <TableCell className="py-2 px-1 text-center">
                          <PaymentStatusDropdown 
                            po={po} 
                            onUpdate={refetch} 
                            onOpenModal={(selectedPo) => setPaymentModalPO(selectedPo)} 
                          />
                        </TableCell>

                        {/* 11. Action */}
                        <TableCell className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost" 
                              size="icon"
                              onClick={() => navigate(`/purchase-orders/${po.id}`)}
                              className="h-7 w-7 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {po.status === 'PENDING' && canAddPurchase && (
                              <Button
                                variant="ghost" 
                                size="icon"
                                onClick={() => navigate(`/purchase-orders/edit/${po.id}`)}
                                className="h-7 w-7 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                            {po.status === 'PENDING' && canAddPurchase && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost" 
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
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
                                    <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              {sortedPOs.length > 0 ? (
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, sortedPOs.length)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{sortedPOs.length}</strong> POs
                </span>
              ) : (
                <span>0 purchase orders found</span>
              )}
            </div>

            {totalPages > 1 && (
              <div>
                <Pagination 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={setCurrentPage} 
                />
              </div>
            )}

            <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-2">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-slate-600 dark:text-slate-300 font-semibold text-[10px] cursor-pointer focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modern Payment Update Modal */}
      {paymentModalPO && (
        <PaymentUpdateModal
          po={paymentModalPO}
          onClose={() => setPaymentModalPO(null)}
          onUpdated={refetch}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search, FileText, Package, CheckCircle2,
  XCircle, AlertTriangle, Clock, RefreshCw, BarChart3, QrCode, Printer, Eye,
  ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, X, ExternalLink,
  ChevronDown, Layers, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DatePicker from '@/components/ui/DatePicker';
import { Pagination } from '@/components/ui/Pagination';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const LAB_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',   color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock,         rowClass: '' },
  LAB_APPROVED:   { label: 'Lab Approved',  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2, rowClass: '' },
  LAB_EXEMPT:     { label: 'Lab Exempt',    color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', icon: ShieldCheck,   rowClass: '' },
  LAB_REJECTED:   { label: 'Lab Rejected',  color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle,   rowClass: 'bg-rose-50/20 dark:bg-rose-950/10 border-l-4 border-l-rose-400' },
  LAB_RESAMPLE:   { label: 'Re-sample',     color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: AlertTriangle, rowClass: 'bg-purple-50/20 dark:bg-purple-950/10' },
};

const INV_STATUS_CONFIG = {
  NOT_UPLOADED: { label: 'Not Uploaded', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  UPLOADED:     { label: 'Stock In',     color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/20' },
};

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

// QR Modal for GRN
function GRNQRModal({ grn, onClose }) {
  if (!grn) return null;

  const labTest = grn.labTest;
  const qrPayload = JSON.stringify({
    grnNumber: grn.referenceNo,
    poNumber: grn.po?.referenceNo,
    supplierName: grn.po?.supplier?.name,
    rawMaterial: grn.po?.name || grn.items?.[0]?.rmName,
    orderedQty: grn.po?.quantity,
    receivedQty: grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0),
    refundAmount: grn.refundAmount,
    amountPaid: grn.amountPaid,
    receivedDate: grn.receivedDate,
    status: grn.status,
    labDecision: labTest?.overallDecision,
    labNotes: labTest?.labNotes,
    labCategoryParams: labTest?.categoryParams,
    inventoryStatus: (grn.status === 'LAB_APPROVED' || grn.inventoryStatus === 'UPLOADED') ? 'UPLOADED' : (grn.inventoryStatus || 'NOT_UPLOADED'),
    generatedAt: new Date().toISOString(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <QrCode className="w-4.5 h-4.5 text-indigo-500" /> GRN QR Code
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">×</button>
        </div>

        <div className="flex justify-center py-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
            <QRCode value={qrPayload} size={150} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {[
            { label: 'GRN Number',   value: grn.referenceNo },
            { label: 'PO Number',    value: grn.po?.referenceNo || '—' },
            { label: 'Supplier',     value: grn.po?.supplier?.name || '—' },
            { label: 'Raw Material', value: grn.po?.name || grn.items?.[0]?.rmName || '—' },
            { label: 'Ordered Qty',  value: `${Number(grn.po?.quantity || 0).toFixed(2)} ${grn.po?.uom?.abbreviation || ''}` },
            { label: 'Received Qty', value: `${grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0)?.toFixed(2)} ${grn.po?.uom?.abbreviation || ''}` },
            { label: 'Amount Paid',  value: `₹${Number(grn.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Refund',       value: `₹${Number(grn.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Received Date',value: grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—' },
            { label: 'Status',       value: LAB_STATUS_CONFIG[grn.status]?.label || grn.status },
            ...(labTest ? [
              { label: 'Lab Decision', value: labTest.overallDecision || '—' },
              { label: 'Lab Notes',    value: labTest.labNotes || '—' },
            ] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
              <span className="font-bold text-slate-850 dark:text-slate-100 text-right ml-4 truncate max-w-[180px]">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-1.5 rounded-xl h-9 text-xs border-slate-205">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs">Close</Button>
        </div>
      </div>
    </div>
  );
}

const GRNListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(s => s.user);
  const canManageReturns = ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'].includes(user?.role);

  // Initialize search from URL params if present (e.g., /grn/list?search=PO-000004 or ?po=PO-000004)
  const initialSearch = searchParams.get('search') || searchParams.get('po') || '';
  const [search, setSearch] = useState(initialSearch);
  const [filterLabStatus, setFilterLabStatus] = useState('ALL');
  const [filterInvStatus, setFilterInvStatus] = useState('ALL');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [qrGRN, setQRGRN] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: grns = [], isLoading, refetch } = useQuery({
    queryKey: ['grn-list'],
    queryFn: () => api.get('/grn/receive').then(r => r.data),
  });

  // Sync state if URL search param updates externally
  useEffect(() => {
    const urlQuery = searchParams.get('search') || searchParams.get('po');
    if (urlQuery !== null && urlQuery !== undefined && urlQuery !== search) {
      setSearch(urlQuery);
    }
  }, [searchParams]);

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterLabStatus, filterInvStatus, fromDate, toDate, sortBy]);

  // Filter Logic: Includes PO Reference #, GRN #, Supplier, Material name, Invoice, LR, E-way, and Batches
  const filtered = useMemo(() => {
    return grns.filter(g => {
      if (filterLabStatus && filterLabStatus !== 'ALL') {
        if (filterLabStatus === 'LAB_EXEMPT') {
          const isExempt = g.isExempt || (g.items && g.items.length > 0 && g.items.every(i => i.labTestRequired === false));
          if (!isExempt) return false;
        } else if (g.status !== filterLabStatus) {
          return false;
        }
      }

      if (filterInvStatus && filterInvStatus !== 'ALL') {
        const isUploaded = g.inventoryStatus === 'UPLOADED' || g.status === 'LAB_APPROVED';
        const effectiveInv = isUploaded ? 'UPLOADED' : (g.inventoryStatus || 'NOT_UPLOADED');
        if (effectiveInv !== filterInvStatus) return false;
      }

      if (fromDate && new Date(g.receivedDate) < fromDate) return false;
      if (toDate && new Date(g.receivedDate) > toDate) return false;

      if (search) {
        const term = search.toLowerCase().trim();
        const matches = (
          (g.referenceNo || '').toLowerCase().includes(term) ||
          (g.po?.referenceNo || '').toLowerCase().includes(term) ||
          (g.po?.supplier?.name || '').toLowerCase().includes(term) ||
          (g.po?.name || '').toLowerCase().includes(term) ||
          (g.invoiceNumber || '').toLowerCase().includes(term) ||
          (g.lrNumber || '').toLowerCase().includes(term) ||
          (g.po?.ewayBillNo || '').toLowerCase().includes(term) ||
          (g.receiver?.name || '').toLowerCase().includes(term) ||
          (g.items && Array.isArray(g.items) && g.items.some(it => 
            (it.rmName || '').toLowerCase().includes(term) ||
            (it.batchNumber || '').toLowerCase().includes(term)
          ))
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [grns, filterLabStatus, filterInvStatus, fromDate, toDate, search]);

  // Sort Logic matched with POListPage architecture
  const sorted = useMemo(() => {
    let list = [...filtered];
    list.sort((a, b) => {
      const dateA = new Date(a.receivedDate || a.createdAt || 0);
      const dateB = new Date(b.receivedDate || b.createdAt || 0);

      if (sortBy === 'recent') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;

      if (sortBy === 'po_asc') {
        return (a.po?.referenceNo || '').localeCompare(b.po?.referenceNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'po_desc') {
        return (b.po?.referenceNo || '').localeCompare(a.po?.referenceNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }

      if (sortBy === 'grn_asc') {
        return (a.referenceNo || '').localeCompare(b.referenceNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'grn_desc') {
        return (b.referenceNo || '').localeCompare(a.referenceNo || '', undefined, { numeric: true, sensitivity: 'base' });
      }

      if (sortBy === 'supplier_asc') {
        const sA = a.po?.supplier?.name || '';
        const sB = b.po?.supplier?.name || '';
        return sA.localeCompare(sB, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'supplier_desc') {
        const sA = a.po?.supplier?.name || '';
        const sB = b.po?.supplier?.name || '';
        return sB.localeCompare(sA, undefined, { sensitivity: 'base' });
      }

      if (sortBy === 'qty_desc') {
        const qA = a.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
        const qB = b.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
        return qB - qA;
      }
      if (sortBy === 'qty_asc') {
        const qA = a.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
        const qB = b.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
        return qA - qB;
      }

      return 0;
    });
    return list;
  }, [filtered, sortBy]);

  // Paginated list
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;
  const paginatedGRNs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  const stats = useMemo(() => {
    return {
      total: grns.length,
      approved: grns.filter(g => g.status === 'LAB_APPROVED').length,
      rejected: grns.filter(g => g.status === 'LAB_REJECTED').length,
      pending: grns.filter(g => g.status === 'PENDING_LAB').length,
    };
  }, [grns]);

  const isFilterActive = search !== '' || filterLabStatus !== 'ALL' || filterInvStatus !== 'ALL' || fromDate !== null || toDate !== null || sortBy !== 'recent';

  const handleResetFilters = () => {
    setSearch('');
    setFilterLabStatus('ALL');
    setFilterInvStatus('ALL');
    setFromDate(null);
    setToDate(null);
    setSortBy('recent');
    setCurrentPage(1);
    setSearchParams({});
  };

  // Header quick sort toggles (Just like /purchase-orders)
  const handleToggleSortDate = () => {
    setSortBy(prev => (prev === 'recent' ? 'oldest' : 'recent'));
    setCurrentPage(1);
  };

  const handleToggleSortPO = () => {
    setSortBy(prev => (prev === 'po_asc' ? 'po_desc' : 'po_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortGRN = () => {
    setSortBy(prev => (prev === 'grn_asc' ? 'grn_desc' : 'grn_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortSupplier = () => {
    setSortBy(prev => (prev === 'supplier_asc' ? 'supplier_desc' : 'supplier_asc'));
    setCurrentPage(1);
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      <DashboardBackButton />
      
      {/* Sleek Compact Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Goods Received Notes (GRN)
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {grns.length} {grns.length === 1 ? 'GRN' : 'GRNs'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              View all goods receipt notes, multi-shipment logs, and raw material inspection records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-3xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={() => navigate('/grn/upcoming')}
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-3xs transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Upcoming Deliveries</span>
          </Button>
        </div>
      </div>

      {/* Stat Cards Grid matched with /purchase-orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard 
          icon={FileText} 
          label="Total GRNs" 
          value={stats.total} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-indigo-50/80 dark:bg-indigo-950/30" 
          iconColorClass="text-indigo-600 dark:text-indigo-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={CheckCircle2} 
          label="Lab Approved" 
          value={stats.approved} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-emerald-50/80 dark:bg-emerald-950/30" 
          iconColorClass="text-emerald-600 dark:text-emerald-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={Clock} 
          label="Pending Lab" 
          value={stats.pending} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-amber-50/80 dark:bg-amber-950/30" 
          iconColorClass="text-amber-600 dark:text-amber-400" 
          isLoading={isLoading}
        />
        <StatCard 
          icon={XCircle} 
          label="Lab Rejected" 
          value={stats.rejected} 
          borderClass="border-slate-200/70 dark:border-slate-800" 
          bgClass="bg-rose-50/80 dark:bg-rose-950/30" 
          iconColorClass="text-rose-600 dark:text-rose-400" 
          isLoading={isLoading}
        />
      </div>

      {/* Lab Rejected warning banner */}
      {stats.rejected > 0 && (
        <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 flex items-center gap-3 shadow-3xs">
          <XCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-rose-800 dark:text-rose-300">
              {stats.rejected} Lab-Rejected GRN shipment(s) are logged in system archives.
            </p>
            <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-0.5">
              Please inspect the rejected items and issue a Purchase Return to the respective supplier.
            </p>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar (Matched with /purchase-orders) */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            {/* Search Input with quick clear */}
            <div className="relative w-full md:w-64 lg:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO, GRN, supplier, material, batch..."
                value={search}
                onChange={(e) => { 
                  setSearch(e.target.value); 
                  setCurrentPage(1); 
                }}
                className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setCurrentPage(1); setSearchParams({}); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {search && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden lg:inline-flex items-center gap-1">
                  <span>Found {sorted.length} matches</span>
                </div>
              )}

              {/* Lab Status Filter */}
              <div className="relative">
                <select
                  value={filterLabStatus}
                  onChange={(e) => {
                    setFilterLabStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Status: All</option>
                  <option value="LAB_APPROVED">Approved</option>
                  <option value="PENDING_LAB">Pending Lab</option>
                  <option value="LAB_EXEMPT">Lab Exempt</option>
                  <option value="LAB_REJECTED">Rejected</option>
                  <option value="LAB_RESAMPLE">Re-sample</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Inventory Filter */}
              <div className="relative">
                <select
                  value={filterInvStatus}
                  onChange={(e) => {
                    setFilterInvStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">Inventory: All</option>
                  <option value="UPLOADED">Stock In Only</option>
                  <option value="NOT_UPLOADED">Not Uploaded</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Date Pickers */}
              <div className="flex items-center gap-1.5">
                <DatePicker
                  value={fromDate}
                  onChange={(d) => { setFromDate(d); setCurrentPage(1); }}
                  modalTitle="From Date"
                  placeholder="From Date"
                  className="w-24 sm:w-28 text-xs h-8"
                  triggerClassName="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg shadow-3xs"
                />
                <DatePicker
                  value={toDate}
                  onChange={(d) => { setToDate(d); setCurrentPage(1); }}
                  modalTitle="To Date"
                  placeholder="To Date"
                  className="w-24 sm:w-28 text-xs h-8"
                  triggerClassName="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg shadow-3xs"
                />
              </div>

              {/* Sort Dropdown (Styled identically to /purchase-orders) */}
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
                  <option value="po_asc">Sort: PO Ref (A → Z)</option>
                  <option value="po_desc">Sort: PO Ref (Z → A)</option>
                  <option value="grn_asc">Sort: GRN Ref (A → Z)</option>
                  <option value="grn_desc">Sort: GRN Ref (Z → A)</option>
                  <option value="supplier_asc">Sort: Supplier (A → Z)</option>
                  <option value="supplier_desc">Sort: Supplier (Z → A)</option>
                  <option value="qty_desc">Sort: Quantity (High to Low)</option>
                  <option value="qty_asc">Sort: Quantity (Low to High)</option>
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

          {/* Table: Exact column structure requested with PO REF FIRST, THEN GRN REF! */}
          {/* Order: SN -> Date -> PO Ref -> GRN Ref -> Supplier -> Received Materials -> Invoice & LR -> Lab Status -> Inventory -> Actions */}
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

                  {/* 3. PO Reference: 11% (PO REF FIRST AS REQUESTED!) */}
                  <TableHead 
                    onClick={handleToggleSortPO}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[11%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>PO Ref</span>
                      {sortBy === 'po_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'po_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 4. GRN Reference: 11% (GRN REF SECOND!) */}
                  <TableHead 
                    onClick={handleToggleSortGRN}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[11%]"
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span>GRN Ref</span>
                      {sortBy === 'grn_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : sortBy === 'grn_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                      )}
                    </div>
                  </TableHead>

                  {/* 5. Supplier: 14% */}
                  <TableHead 
                    onClick={handleToggleSortSupplier}
                    className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-[14%]"
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

                  {/* 6. Received Materials & Batches: 22% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[22%]">
                    <div className="truncate">Received Materials</div>
                  </TableHead>

                  {/* 7. Invoice & LR: 9% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[9%]">
                    <div className="truncate">Invoice & LR</div>
                  </TableHead>

                  {/* 8. Lab Status: 9% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[9%]">
                    <div className="truncate">Lab Status</div>
                  </TableHead>

                  {/* 9. Inventory: 6.5% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold w-[6.5%]">
                    <div className="truncate">Inventory</div>
                  </TableHead>

                  {/* 10. Actions: 6.5% */}
                  <TableHead className="py-2 px-2 text-[10px] uppercase tracking-wider font-extrabold text-center w-[6.5%]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j} className="py-2.5 px-2">
                          <Skeleton className="h-4 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedGRNs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <FileText className="w-8 h-8 opacity-30" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No GRN records found</p>
                        <p className="text-xs text-slate-400">Try adjusting your search criteria or filter options.</p>
                        {isFilterActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="mt-2 text-xs h-8 rounded-lg"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" /> Clear All Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGRNs.map((grn, index) => {
                    const isExempt = grn.isExempt || (grn.items && grn.items.length > 0 && grn.items.every(i => i.labTestRequired === false));
                    const labCfg = isExempt ? LAB_STATUS_CONFIG.LAB_EXEMPT : (LAB_STATUS_CONFIG[grn.status] || LAB_STATUS_CONFIG.PENDING_LAB);
                    const LabIcon = labCfg.icon;
                    const isUploaded = grn.inventoryStatus === 'UPLOADED' || grn.status === 'LAB_APPROVED' || isExempt;
                    const invStatus = isUploaded ? 'UPLOADED' : (grn.inventoryStatus || 'NOT_UPLOADED');
                    const invCfg = INV_STATUS_CONFIG[invStatus] || INV_STATUS_CONFIG.NOT_UPLOADED;
                    const isRejected = grn.status === 'LAB_REJECTED';

                    return (
                      <TableRow
                        key={grn.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${labCfg.rowClass}`}
                      >
                        {/* 1. SN */}
                        <TableCell className="py-2 px-1 text-center font-mono text-[10px] text-slate-400 font-bold">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </TableCell>

                        {/* 2. Received Date */}
                        <TableCell className="py-2 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy') : '—'}
                        </TableCell>

                        {/* 3. PO REF FIRST */}
                        <TableCell className="py-2 px-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSearch(grn.po?.referenceNo || '');
                                setCurrentPage(1);
                              }}
                              className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/70 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                              title="Click to filter by this PO"
                            >
                              {grn.po?.referenceNo || '—'}
                            </button>
                            {grn.poId && (
                              <button
                                type="button"
                                onClick={() => navigate(`/purchase-orders/${grn.poId}`)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors"
                                title="Open Purchase Order details"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </TableCell>

                        {/* 4. GRN REF SECOND */}
                        <TableCell className="py-2 px-2 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/grn/view/${grn.id}`)}
                              className={`font-mono text-xs font-black text-left cursor-pointer transition-colors ${
                                isRejected
                                  ? 'text-rose-600 dark:text-rose-400 hover:underline'
                                  : 'text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400'
                              }`}
                              title="Click to view GRN note"
                            >
                              {grn.referenceNo}
                            </button>
                            <div className="flex items-center gap-1">
                              {isRejected && (
                                <span className="px-1.5 py-0.2 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] rounded font-extrabold inline-flex items-center gap-0.5 self-start">
                                  <XCircle className="w-2.5 h-2.5" /> Rejected
                                </span>
                              )}
                              {grn.isShortDelivery && !isRejected && (
                                <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] rounded font-bold self-start">
                                  Short
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* 5. Supplier */}
                        <TableCell className="py-2 px-2 min-w-0">
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={grn.po?.supplier?.name}>
                              {grn.po?.supplier?.name || '—'}
                            </span>
                            {grn.po?.supplier?.phone && (
                              <span className="text-[10px] text-slate-400 block truncate">{grn.po.supplier.phone}</span>
                            )}
                          </div>
                        </TableCell>

                        {/* 6. Received Materials */}
                        <TableCell className="py-2 px-2">
                          <div className="flex flex-col gap-1 max-w-[280px]">
                            {grn.items && grn.items.length > 0 ? (
                              grn.items.map((item, itIdx) => {
                                const itemExpected = Number(item.expectedQty || 0);
                                const itemReceived = Number(item.actualReceivedQty || 0);
                                const itemVariance = itemReceived - itemExpected;
                                const itemUom = grn.po?.uom?.abbreviation || '';

                                return (
                                  <div key={item.id || itIdx} className="flex items-center justify-between gap-1.5 text-[10.5px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-0.5">
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={item.rmName}>
                                        {item.rmName}
                                      </span>
                                      <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                        <span>Recv: <strong className="text-slate-700 dark:text-slate-300 font-mono">{itemReceived}</strong>/{itemExpected} {itemUom}</span>
                                        {item.batchNumber && (
                                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1 rounded text-[8.5px]">
                                            {item.batchNumber}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Variance Badge */}
                                    <div className="shrink-0">
                                      {itemVariance < 0 ? (
                                        <span className="text-[8.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 px-1 py-0.2 rounded">
                                          {itemVariance.toFixed(1)}
                                        </span>
                                      ) : itemVariance > 0 ? (
                                        <span className="text-[8.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-1 py-0.2 rounded">
                                          +{itemVariance.toFixed(1)}
                                        </span>
                                      ) : (
                                        <span className="text-[8.5px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 px-1 py-0.2 rounded font-bold">
                                          Exact
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                          </div>
                        </TableCell>

                        {/* 7. Invoice & LR */}
                        <TableCell className="py-2 px-2 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 truncate" title={grn.invoiceNumber || '—'}>
                              {grn.invoiceNumber || '—'}
                            </span>
                            {(grn.lrNumber || grn.po?.ewayBillNo) && (
                              <span className="text-[9.5px] text-slate-400 font-mono truncate" title={grn.lrNumber || grn.po?.ewayBillNo}>
                                LR: {grn.lrNumber || grn.po?.ewayBillNo}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 8. Lab Status */}
                        <TableCell className="py-2 px-2 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${labCfg.color}`}>
                            <LabIcon className="w-3 h-3" />
                            <span>{labCfg.label}</span>
                          </span>
                        </TableCell>

                        {/* 9. Inventory */}
                        <TableCell className="py-2 px-2 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${invCfg.color}`}>
                            <Package className="w-2.5 h-2.5" />
                            <span>{invCfg.label}</span>
                          </span>
                        </TableCell>

                        {/* 10. Actions */}
                        <TableCell className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/grn/view/${grn.id}`)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                              title="View GRN File"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setQRGRN(grn)}
                              className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                              title="View QR Label"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            {isRejected && canManageReturns && (
                              <button
                                type="button"
                                onClick={() => navigate('/purchase-return/add', {
                                  state: { grnId: grn.id, poId: grn.poId, returnReason: 'LAB_REJECTED', initiatedBy: 'LAB_REJECTED' }
                                })}
                                className="px-2 py-0.5 text-rose-700 bg-rose-50/80 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded text-[9.5px] font-bold cursor-pointer"
                                title="Initiate Purchase Return"
                              >
                                Return
                              </button>
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

          {/* Footer info & Pagination Controls */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length} GRNs
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Active Filter Matches: {filtered.length} entries
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Modal */}
      {qrGRN && <GRNQRModal grn={qrGRN} onClose={() => setQRGRN(null)} />}
    </div>
  );
};

export default GRNListPage;

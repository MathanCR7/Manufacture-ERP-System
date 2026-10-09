import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  Package, 
  Filter, 
  ArrowLeft, 
  Lock, 
  Scale, 
  Tag, 
  Calendar, 
  ArrowUpDown,
  Building,
  Truck,
  FileText,
  X,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';
import Swal from 'sweetalert2';

// Robust, crash-proof date formatting helper
function formatSafeDate(dateVal, pattern = 'dd-MM-yyyy') {
  if (!dateVal || dateVal === '—' || dateVal === '-' || dateVal === 'N/A' || dateVal === 'null' || dateVal === 'undefined') {
    return '—';
  }
  // Check if string is already formatted like DD-MM-YYYY
  if (typeof dateVal === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      return typeof dateVal === 'string' && dateVal.length > 0 && dateVal !== '—' ? dateVal : '—';
    }
    return format(d, pattern);
  } catch {
    return typeof dateVal === 'string' && dateVal.length > 0 && dateVal !== '—' ? dateVal : '—';
  }
}

export default function RMExpiryStockPage() {
  const navigate = useNavigate();

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | EXPIRED | EXPIRING_SOON | SAFE | NO_EXPIRY
  const [daysHorizon, setDaysHorizon] = useState('ALL'); // ALL | 7 | 30 | 60 | 90
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Modal State for Inspecting Batch Splits
  const [inspectModalBatch, setInspectModalBatch] = useState(null);

  // Fetch FEFO data from backend
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rm-fefo-stock', categoryFilter, statusFilter, daysHorizon],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (daysHorizon !== 'ALL') params.append('daysWindow', daysHorizon);

      const response = await api.get(`/rm-stock/fefo?${params.toString()}`);
      setLastRefreshed(new Date());
      return response.data;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const batches = data?.batches || [];
  const summary = data?.summary || {
    totalBatches: 0,
    totalExpiredBatches: 0,
    totalExpiredQty: 0,
    totalExpiredValue: 0,
    totalExpiringSoonBatches: 0,
    totalExpiringSoonQty: 0,
    totalExpiringSoonValue: 0,
    totalSafeBatches: 0,
    totalSafeQty: 0,
    totalLossAtRisk: 0,
  };

  // Distinct Categories for Dropdown
  const categoryOptions = useMemo(() => {
    const set = new Set();
    batches.forEach(b => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [batches]);

  // Client-side text search
  const filteredBatches = useMemo(() => {
    if (!searchTerm.trim()) return batches;
    const s = searchTerm.trim().toLowerCase();
    return batches.filter(b => 
      b.rawMaterialName.toLowerCase().includes(s) ||
      b.rawMaterialCode.toLowerCase().includes(s) ||
      b.batchNumber.toLowerCase().includes(s) ||
      (b.mfgBatchNo && b.mfgBatchNo.toLowerCase().includes(s)) ||
      b.category.toLowerCase().includes(s) ||
      b.poReferenceNo.toLowerCase().includes(s) ||
      b.grnReferenceNo.toLowerCase().includes(s) ||
      b.supplierName.toLowerCase().includes(s)
    );
  }, [batches, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBatches.slice(start, start + itemsPerPage);
  }, [filteredBatches, currentPage, itemsPerPage]);

  const handleManualRefresh = () => {
    refetch();
  };

  // Move to Wastage action
  const handleMoveToWastage = (batch) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: 'Move Batch to Wastage?',
      html: `
        <div class="text-left text-xs space-y-2 mt-2">
          <p>You are about to transfer expired/expiring batch to raw material waste:</p>
          <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono space-y-1">
            <div><span class="text-slate-400">Material:</span> <b>${batch.rawMaterialName} (${batch.rawMaterialCode})</b></div>
            <div><span class="text-slate-400">Our Batch:</span> <b class="text-indigo-600 dark:text-indigo-400">${batch.batchNumber}</b></div>
            <div><span class="text-slate-400">Batch Qty:</span> <b>${batch.netQty} ${batch.uom}</b></div>
            <div><span class="text-slate-400">Weight:</span> <b>${batch.weight || '—'}</b></div>
            <div><span class="text-slate-400">MFG Batch:</span> <b>${batch.mfgBatchNo || '—'}</b></div>
            <div><span class="text-slate-400">Expiry Date:</span> <b class="text-rose-600">${formatSafeDate(batch.expiryDate)}</b></div>
            <div><span class="text-slate-400">Est. Loss:</span> <b>₹${(batch.batchValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
          </div>
          <p class="text-[11px] text-slate-500">This will prefill the RM Waste docket with full batch traceability.</p>
        </div>
      `,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonText: 'Yes, Proceed to Waste Docket',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl',
        confirmButton: 'rounded-xl text-xs font-bold px-4 py-2',
        cancelButton: 'rounded-xl text-xs font-bold px-4 py-2'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        navigate('/waste/raw-material/add', {
          state: {
            prefillBatch: {
              rawMaterialId: batch.rawMaterialId,
              rawMaterialName: batch.rawMaterialName,
              rawMaterialCode: batch.rawMaterialCode,
              category: batch.category,
              uom: batch.uom,
              totalRmStock: batch.totalRmStock,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              quantity: batch.netQty,
              batchQuantity: batch.netQty,
              weight: batch.weight || '',
              mfgBatchNo: batch.mfgBatchNo || '',
              mfgDate: batch.mfgDate ? (formatSafeDate(batch.mfgDate, 'yyyy-MM-dd') === '—' ? '' : formatSafeDate(batch.mfgDate, 'yyyy-MM-dd')) : '',
              expiryDate: batch.expiryDate ? (formatSafeDate(batch.expiryDate, 'yyyy-MM-dd') === '—' ? '' : formatSafeDate(batch.expiryDate, 'yyyy-MM-dd')) : '',
              ratePerUnit: batch.ratePerUnit || 0,
              lossAmount: batch.batchValue || 0,
              note: `Expired batch ${batch.batchNumber} moved to wastage from FEFO stock expiry tracking (${batch.healthStatus === 'EXPIRED' ? 'Expired' : 'Expiring Soon'}).`
            }
          }
        });
      }
    });
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredBatches.length === 0) {
      Swal.fire({ title: 'No Data', text: 'No batches available to export.', icon: 'info' });
      return;
    }

    const rows = filteredBatches.map((b, idx) => ({
      'SN': idx + 1,
      'Raw Material Code': b.rawMaterialCode,
      'Raw Material Name': b.rawMaterialName,
      'Category': b.category,
      'Total RM Stock': `${b.totalRmStock} ${b.uom}`,
      'Our Batch No': b.batchNumber,
      'Batch Qty': b.netQty,
      'UOM': b.uom,
      'Weight': b.weight || '—',
      'MFG Batch No': b.mfgBatchNo || '—',
      'MFG Date': formatSafeDate(b.mfgDate),
      'Expiry Date': b.expiryDate ? formatSafeDate(b.expiryDate) : 'No Expiry',
      'Expiry Source': b.expirySource,
      'Lab Status': b.labDecision,
      'Days Remaining': b.daysRemaining !== null ? b.daysRemaining : '—',
      'Expiry Status': b.healthStatus,
      'Est. Batch Value (₹)': b.batchValue || 0,
      'PO Number': b.poReferenceNo,
      'GRN Number': b.grnReferenceNo,
      'Supplier': b.supplierName,
      'Storage Location': b.storageLocation,
      'Batch Status': b.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FEFO_RM_Expiry');
    XLSX.writeFile(wb, `FEFO_RM_Expiry_Stock_${formatSafeDate(new Date())}.xlsx`);
  };

  return (
    <div className="w-full px-3 sm:px-4 py-2.5 space-y-3 mx-auto transition-all duration-200">
      {/* Top Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/rm/stock')}
            className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Back to All RM Stock"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800 shadow-3xs shrink-0">
            <Clock className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Upcoming & Expired RM (FEFO Order)
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800">
                {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              First-Expired, First-Out (FEFO) batch priority. Quality tested expiry prioritized over PO/GRN declared expiry.
              <span className="ml-2 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                Synced: {lastRefreshed.toLocaleTimeString()}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/rm/stock')}
            className="h-8 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/80 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer inline-flex items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5 text-indigo-500" />
            <span>All RM Stock</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isFetching ? 'Syncing...' : 'Sync'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-8 px-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-3xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export FEFO</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Expired Batches (RED) */}
        <div 
          onClick={() => { setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden shadow-3xs ${
            statusFilter === 'EXPIRED' 
              ? 'bg-rose-100/70 dark:bg-rose-950/80 border-rose-400 dark:border-rose-600 ring-2 ring-rose-500/30' 
              : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent dark:from-rose-500/20 dark:via-slate-900 dark:to-slate-900 border-rose-200/80 dark:border-rose-800/60 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Expired RM Batches
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-black font-mono">
              {summary.totalExpiredBatches} Batches
            </span>
          </div>
          <div className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">
            {summary.totalExpiredQty.toLocaleString()} <span className="text-xs font-semibold text-rose-500">Units</span>
          </div>
          <div className="text-[10px] text-rose-600/90 dark:text-rose-400 mt-0.5 font-medium flex items-center justify-between">
            <span>Expired Value: ₹{summary.totalExpiredValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-3xs font-bold uppercase tracking-wider bg-rose-200/80 dark:bg-rose-900 px-1.5 py-0.2 rounded">Action: Move to Waste</span>
          </div>
        </div>

        {/* Card 2: Expiring Soon (<30 Days) (YELLOW) */}
        <div 
          onClick={() => { setStatusFilter(statusFilter === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden shadow-3xs ${
            statusFilter === 'EXPIRING_SOON' 
              ? 'bg-amber-100/70 dark:bg-amber-950/80 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/30' 
              : 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-slate-900 dark:to-slate-900 border-amber-200/80 dark:border-amber-800/60 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Expiring Soon (≤30 Days)
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black font-mono">
              {summary.totalExpiringSoonBatches} Batches
            </span>
          </div>
          <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
            {summary.totalExpiringSoonQty.toLocaleString()} <span className="text-xs font-semibold text-amber-500">Units</span>
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5 font-medium">
            At-Risk Value: ₹{summary.totalExpiringSoonValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Card 3: Safe / Optimal Batches (GREEN) */}
        <div 
          onClick={() => { setStatusFilter(statusFilter === 'SAFE' ? 'ALL' : 'SAFE'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden shadow-3xs ${
            statusFilter === 'SAFE' 
              ? 'bg-emerald-100/70 dark:bg-emerald-950/80 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/30' 
              : 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-slate-900 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-800/60 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Safe & Fresh Stock
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black font-mono">
              {summary.totalSafeBatches} Batches
            </span>
          </div>
          <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {summary.totalSafeQty.toLocaleString()} <span className="text-xs font-semibold text-emerald-500">Units</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Expiry beyond 30 days • Prioritize in FEFO dispatch
          </div>
        </div>

        {/* Card 4: Total Value at Expiry Risk */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-500/20 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/60 shadow-3xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 dark:text-indigo-400">
              Total Expiry Risk Value
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
              Loss Exposure
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
            ₹{summary.totalLossAtRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Expired: ₹{summary.totalExpiredValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} • Near Exp: ₹{summary.totalExpiringSoonValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Pro Toolbar: Search + Category + Status + Days Horizon */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search material, code, batch #, MFG batch, supplier..."
                  value={searchTerm}
                  onChange={(e) => { 
                    setSearchTerm(e.target.value); 
                    setCurrentPage(1); 
                  }}
                  className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs bg-white dark:bg-slate-950 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 h-8 shadow-3xs transition-all placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-1.5 flex-wrap justify-start lg:justify-end">
              {/* Category Filter */}
              <div className="relative flex items-center">
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer shadow-3xs"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none text-slate-400" />
              </div>

              {/* Status Filter */}
              <div className="relative flex items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-bold border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer shadow-3xs"
                >
                  <option value="ALL">All Expiry Statuses</option>
                  <option value="EXPIRED">🔴 Expired Only</option>
                  <option value="EXPIRING_SOON">🟡 Expiring Soon (≤30d)</option>
                  <option value="SAFE">🟢 Safe Batches</option>
                  <option value="NO_EXPIRY">⚪ No Expiry Set</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none text-slate-400" />
              </div>

              {/* Days Horizon Filter */}
              <div className="relative flex items-center">
                <select
                  value={daysHorizon}
                  onChange={(e) => {
                    setDaysHorizon(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer shadow-3xs"
                >
                  <option value="ALL">All Horizons</option>
                  <option value="7">Next 7 Days</option>
                  <option value="30">Next 30 Days</option>
                  <option value="60">Next 60 Days</option>
                  <option value="90">Next 90 Days</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none text-slate-400" />
              </div>

              {/* Reset Filters */}
              {(categoryFilter !== 'ALL' || statusFilter !== 'ALL' || daysHorizon !== 'ALL' || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter('ALL');
                    setStatusFilter('ALL');
                    setDaysHorizon('ALL');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                  title="Reset all filters"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* FEFO Table */}
          <div className="overflow-x-auto min-h-[380px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider select-none">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Raw Material</th>
                  <th className="py-2.5 px-3 text-right">Total RM Stock</th>
                  <th className="py-2.5 px-3">Our Batch No (Sequential)</th>
                  <th className="py-2.5 px-3 text-right">Batch Stock</th>
                  <th className="py-2.5 px-3">Weight</th>
                  <th className="py-2.5 px-3">MFG Batch</th>
                  <th className="py-2.5 px-3">MFG Date</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-center">Expiry Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                        <span className="text-xs font-semibold">Loading FEFO Batch Matrix...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span className="text-xs font-semibold">No batches found matching current filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedBatches.map((b, idx) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                    const isExpired = b.healthStatus === 'EXPIRED';
                    const isExpiringSoon = b.healthStatus === 'EXPIRING_SOON';
                    const isSafe = b.healthStatus === 'SAFE';

                    return (
                      <tr 
                        key={b.id || idx}
                        className={`transition-colors duration-150 ${
                          isExpired 
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-950/40' 
                            : (isExpiringSoon 
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/40 dark:hover:bg-amber-950/30' 
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40')
                        }`}
                      >
                        {/* 1. SN */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400 font-bold">
                          {rowNumber}
                        </td>

                        {/* 2. Raw Material Info */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white leading-tight">
                              {b.rawMaterialName}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-3xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 px-1.5 py-0.2 rounded">
                                {b.rawMaterialCode}
                              </span>
                              <span className="text-3xs text-slate-400">•</span>
                              <span className="text-3xs font-semibold text-slate-500 dark:text-slate-400">
                                {b.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Total RM Stock */}
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {b.totalRmStock.toLocaleString()}
                          </span>
                          <span className="text-3xs text-slate-400 ml-1 uppercase">{b.uom}</span>
                        </td>

                        {/* 4. Our Batch Number (Locked & Sequential) */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-300 tracking-wide select-all">
                              {b.batchNumber}
                            </span>
                            {b.batchNumber.match(/-[A-Z]$/) && (
                              <span className="text-3xs font-black bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1 py-0.2 rounded">
                                Split {b.batchNumber.slice(-1)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Batch Stock Qty */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <div className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">
                              {b.netQty.toLocaleString()}
                              <span className="text-3xs font-semibold text-slate-500 uppercase ml-1">{b.uom}</span>
                            </div>
                            <span className="text-3xs text-slate-400 font-mono">
                              Valued: ₹{(b.batchValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </td>

                        {/* 6. Weight */}
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                            {b.weight || '—'}
                          </span>
                        </td>

                        {/* 7. MFG Batch */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                            {b.mfgBatchNo || '—'}
                          </span>
                        </td>

                        {/* 8. MFG Date */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {formatSafeDate(b.mfgDate)}
                        </td>

                        {/* 9. Expiry Date & Lab Source */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className={`font-mono font-bold text-xs ${
                              isExpired ? 'text-rose-600 dark:text-rose-400' : (isExpiringSoon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100')
                            }`}>
                              {b.expiryDate ? formatSafeDate(b.expiryDate) : 'No Expiry'}
                            </span>
                            <span className="text-3xs font-semibold text-slate-400">
                              {b.isLabExempt ? 'Lab Exempt' : (b.expirySource === 'LAB_TEST' ? 'Lab Verified' : 'Declared')}
                            </span>
                          </div>
                        </td>

                        {/* 10. Expiry Status Badge */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              EXPIRED ({Math.abs(b.daysRemaining)}d ago)
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              IN {b.daysRemaining} DAYS
                            </span>
                          ) : isSafe ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              SAFE ({b.daysRemaining}d)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                              NO EXPIRY
                            </span>
                          )}
                        </td>

                        {/* 11. Actions: View Modal & Move to Wastage */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInspectModalBatch(b)}
                              className="h-7 px-2 text-3xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-3xs cursor-pointer inline-flex items-center gap-1"
                              title="View PO, GRN & all split batch allocations"
                            >
                              <Eye className="w-3 h-3 text-indigo-600" />
                              <span>View</span>
                            </Button>

                            {/* Move to Wastage Button */}
                            <Button
                              size="sm"
                              onClick={() => handleMoveToWastage(b)}
                              className={`h-7 px-2 text-3xs font-extrabold rounded-lg shadow-3xs cursor-pointer inline-flex items-center gap-1 transition-colors ${
                                isExpired
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}
                              title="Transfer batch stock to RM Wastage"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Move to Wastage</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
              Showing {filteredBatches.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredBatches.length)} of {filteredBatches.length} batches
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ────────────────── INSPECT BATCH DETAILS MODAL ────────────────── */}
      {inspectModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden text-xs flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Batch Inspection & Split Allocation Breakdown
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {inspectModalBatch.rawMaterialName} ({inspectModalBatch.rawMaterialCode}) • {inspectModalBatch.batchNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-3xs uppercase font-extrabold text-slate-400">PO Reference</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">{inspectModalBatch.poReferenceNo}</div>
                </div>
                <div>
                  <span className="text-3xs uppercase font-extrabold text-slate-400">GRN Reference</span>
                  <div className="font-mono font-bold text-teal-600 dark:text-teal-400">{inspectModalBatch.grnReferenceNo}</div>
                </div>
                <div>
                  <span className="text-3xs uppercase font-extrabold text-slate-400">Supplier</span>
                  <div className="font-bold text-slate-900 dark:text-white truncate">{inspectModalBatch.supplierName}</div>
                </div>
                <div>
                  <span className="text-3xs uppercase font-extrabold text-slate-400">Storage Location</span>
                  <div className="font-medium text-slate-700 dark:text-slate-300">{inspectModalBatch.storageLocation}</div>
                </div>
              </div>

              {/* Batches Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    BATCHES ({inspectModalBatch.allSplitBatches?.length || 1} BATCHES)
                  </h3>
                  <Badge variant="outline" className="text-3xs font-mono font-bold text-indigo-600">
                    All Allocated ({inspectModalBatch.netQty} {inspectModalBatch.uom})
                  </Badge>
                </div>
                <span className="text-3xs text-slate-400">
                  {inspectModalBatch.isLabExempt ? 'Lab Exempt' : `Quality Status: ${inspectModalBatch.labDecision}`}
                </span>
              </div>

              {/* All Split Batches Breakdown */}
              <div className="space-y-2">
                {inspectModalBatch.allSplitBatches?.map((sb, sbIdx) => (
                  <div 
                    key={sbIdx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                          #{sb.splitIndex || sbIdx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-500 font-semibold text-xs">Our Batch:</span>
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tracking-wide">
                            {sb.batchNumber}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold text-xs">Batch Qty:</span>
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {sb.quantity} {inspectModalBatch.uom}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-3xs font-extrabold uppercase text-slate-400 flex items-center gap-1">
                          <Scale className="w-3 h-3 text-indigo-500" /> Weight
                        </span>
                        <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                          {sb.weight || inspectModalBatch.weight || '—'}
                        </div>
                      </div>

                      <div>
                        <span className="text-3xs font-extrabold uppercase text-slate-400 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-indigo-500" /> MFG Batch
                        </span>
                        <div className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                          {sb.mfgBatchNo || inspectModalBatch.mfgBatchNo || '—'}
                        </div>
                      </div>

                      <div>
                        <span className="text-3xs font-extrabold uppercase text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" /> MFG Date
                        </span>
                        <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                          {formatSafeDate(sb.mfgDate || inspectModalBatch.mfgDate)}
                        </div>
                      </div>

                      <div>
                        <span className="text-3xs font-extrabold uppercase text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" /> Exp Date
                        </span>
                        <div className="font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                          {formatSafeDate(sb.expDate || inspectModalBatch.expiryDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Expiry Health: <b className={`${inspectModalBatch.healthStatus === 'EXPIRED' ? 'text-rose-600' : (inspectModalBatch.healthStatus === 'EXPIRING_SOON' ? 'text-amber-600' : 'text-emerald-600')}`}>{inspectModalBatch.healthStatus}</b>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const target = inspectModalBatch;
                    setInspectModalBatch(null);
                    handleMoveToWastage(target);
                  }}
                  className="h-8 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Move Batch to Wastage</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectModalBatch(null)}
                  className="h-8 px-3 text-xs font-semibold rounded-xl"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

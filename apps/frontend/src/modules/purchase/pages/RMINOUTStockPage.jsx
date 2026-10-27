import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  Package,
  Search,
  AlertTriangle,
  Clock,
  Eye,
  FileSpreadsheet,
  IndianRupee,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  ExternalLink,
  Layers,
  Factory,
  Truck,
  RotateCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Boxes,
  Maximize2,
  Loader2,
  Sparkles,
  Download,
  FileText,
  AlertOctagon,
  ShieldAlert,
  SlidersHorizontal,
  TableProperties,
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  exportStockInOutMatrixToExcel,
  exportMasterSummaryToExcel,
  exportDateWiseLedgerToExcel,
  exportCompleteEnterpriseWorkbookToExcel
} from '../utils/exportRMINOUTMatrixExcel';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import RMHistoryDrawer from '@/modules/purchase/components/RMHistoryDrawer';
import RMStockQueryModal from '@/modules/purchase/components/RMStockQueryModal';

// Reusable Searchable Dropdown Component for Category & Code Filters
function SearchableFilterDropdown({
  label,
  placeholder,
  value,
  onChange,
  options = [],
  className = '',
  icon: Icon = Search
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(opt =>
      (opt.label || '').toLowerCase().includes(term) ||
      (opt.subLabel || '').toLowerCase().includes(term) ||
      (opt.value || '').toLowerCase().includes(term)
    );
  }, [options, search]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];
  const isFiltered = value && value !== 'ALL';

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-between gap-1.5 text-left cursor-pointer ${
          isFiltered
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold shadow-2xs'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${isFiltered ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('ALL');
              }}
              className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition-colors"
              title="Reset selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] max-w-[340px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Internal Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-6 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1.5 focus:ring-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-slate-400">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <div className="truncate font-medium">{opt.label}</div>
                      {opt.subLabel && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    {opt.badge !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RMINOUTStockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // URL query params (defaults to 'all' - All Time)
  const initialPeriod = searchParams.get('period') || 'all';
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || 'ALL';
  const initialCode = searchParams.get('code') || 'ALL';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';

  // Time Period State - default is 'all' (All Time)
  const [period, setPeriod] = useState(initialPeriod); // today | yesterday | this_week | last_week | this_month | last_month | all | custom
  const [customStartDate, setCustomStartDate] = useState(initialStartDate);
  const [customEndDate, setCustomEndDate] = useState(initialEndDate);
  const [appliedCustomStart, setAppliedCustomStart] = useState(initialStartDate);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState(initialEndDate);

  // View Mode: 'ledger' (Date-Wise Ledger & Movement Matrix - Default) | 'material' (Grouped by Material Summary)
  const [viewMode, setViewMode] = useState('ledger');
  // Ledger Sub-Mode: 'matrix' (Date-Wise Movement Matrix Grid matching Excel) | 'stream' (Flat Transaction List)
  const [ledgerSubMode, setLedgerSubMode] = useState('matrix');
  const [isCompactDensity, setIsCompactDensity] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [codeFilter, setCodeFilter] = useState(initialCode);
  const [movementFilter, setMovementFilter] = useState('ALL'); // ALL | IN_PROGRESS | FREE_AVAILABLE | LAB_REJECTED | WITH_MOVEMENT | IN_ONLY | OUT_ONLY | NET_POSITIVE | NET_NEGATIVE | LOW_STOCK | OUT_OF_STOCK
  const [sortBy, setSortBy] = useState('code_asc');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Pagination State - Default 15 items per page as requested
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Expanded Material Rows for inline ledger view
  const [expandedMaterialIds, setExpandedMaterialIds] = useState(new Set());
  const [expandedLoadingIds, setExpandedLoadingIds] = useState(new Set());
  const [materialHistoryCache, setMaterialHistoryCache] = useState({});

  // History Drawer & Stock Query Modal State
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyInitialTab, setHistoryInitialTab] = useState('timeline');
  const [selectedStockQueryId, setSelectedStockQueryId] = useState(null);
  const [isStockQueryOpen, setIsStockQueryOpen] = useState(false);

  // 1. Primary Query: Fetch Base RM Stock (Auto-refresh enabled on mount and focus)
  const {
    data: baseStock = [],
    isLoading: isBaseLoading,
    isFetching: isBaseFetching,
    refetch: refetchBase
  } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock');
      setLastRefreshed(new Date());
      return response.data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // 2. Secondary Query: Dedicated /rm-stock/in-out endpoint (Auto-refresh enabled on mount and focus)
  const {
    data: dedicatedData = null,
    isFetching: isDedicatedFetching,
    refetch: refetchDedicated
  } = useQuery({
    queryKey: ['rm-in-out-stock-api', period, appliedCustomStart, appliedCustomEnd],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append('period', period);
        if (period === 'custom') {
          if (appliedCustomStart) params.append('startDate', appliedCustomStart);
          if (appliedCustomEnd) params.append('endDate', appliedCustomEnd);
        }
        const response = await api.get(`/rm-stock/in-out?${params.toString()}`);
        return response.data;
      } catch (err) {
        return null;
      }
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Automatically refresh data when opening the page
  useEffect(() => {
    refetchBase();
    refetchDedicated();
  }, [refetchBase, refetchDedicated]);

  // Calculate Date Boundaries for current period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = null;

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (period === 'this_week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - dayOfWeek);
      monday.setHours(0, 0, 0, 0);
      start = monday;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'last_week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(lastMonday.getDate() - dayOfWeek - 7);
      lastMonday.setHours(0, 0, 0, 0);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastSunday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);
      start = lastMonday;
      end = lastSunday;
    } else if (period === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (period === 'custom' || appliedCustomStart || appliedCustomEnd) {
      if (appliedCustomStart) {
        const p = String(appliedCustomStart).split('-');
        start = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
      }
      if (appliedCustomEnd) {
        const p = String(appliedCustomEnd).split('-');
        end = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59, 999);
      }
    }

    return { start, end };
  }, [period, appliedCustomStart, appliedCustomEnd]);

  const isDateInPeriod = useCallback((dateStr) => {
    if (!dateRange.start && !dateRange.end) return true;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (dateRange.start && t < dateRange.start.getTime()) return false;
    if (dateRange.end && t > dateRange.end.getTime()) return false;
    return true;
  }, [dateRange]);

  // Load History for expanded row (fallback mode)
  const fetchItemHistory = useCallback(async (matId) => {
    if (materialHistoryCache[matId]) return materialHistoryCache[matId];
    try {
      setExpandedLoadingIds(prev => new Set(prev).add(matId));
      const res = await api.get(`/rm-stock/${matId}/history`);
      const hData = res.data;

      const txList = [];

      // GRN receipts (IN)
      (hData.grnReceipts || []).forEach(g => {
        const isLabRejected = String(g.status || '').toUpperCase().includes('REJECT') || Number(g.rejectedQty || 0) > 0;
        const labStatus = isLabRejected ? 'LAB_REJECTED' : 'LAB_APPROVED';
        const rate = Number(g.unitPrice || g.rate || 0);
        const qty = Number(g.actualReceivedQty || 0);
        const amount = Math.round(qty * rate * 100) / 100;
        const poRef = g.poReferenceNo || 'PO';
        const batchNo = g.batch?.batchNumber || '—';

        txList.push({
          id: `grn-${g.id}`,
          date: g.receivedDate,
          flow: 'IN',
          type: 'GRN',
          typeLabel: isLabRejected ? 'GRN Inward (Lab Rejected)' : 'GRN Inward Receipt',
          quantity: qty,
          rate,
          amount,
          referenceNo: g.referenceNo || 'GRN',
          poReferenceNo: poRef,
          poId: g.poId,
          grnId: g.grnId || g.id,
          batchNumber: batchNo,
          partyName: g.supplierName || 'Vendor Receipt',
          user: g.receivedByName || 'Gate Officer',
          labStatus,
          isLabRejected,
          notes: g.discrepancyNotes || `Challan: ${g.challanNumber || 'N/A'}`,
          compositeComment: `PO: ${poRef} | Batch: ${batchNo} | Qty: ${qty} | Rate: ₹${rate.toFixed(2)} | Amount: ₹${amount.toFixed(2)} | Lab/QC: ${labStatus}`
        });
      });

      // Stock Adjustments
      (hData.stockAdjustments || []).forEach(a => {
        const isAdd = a.type === 'ADDITION';
        const qty = Number(a.quantity || 0);
        txList.push({
          id: `adj-${a.id}`,
          date: a.createdAt,
          flow: isAdd ? 'IN' : 'OUT',
          type: isAdd ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUB',
          typeLabel: isAdd ? 'Stock Adjustment (+)' : 'Stock Adjustment (-)',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: `ADJ-${a.id.slice(-6).toUpperCase()}`,
          batchNumber: 'Manual Correction',
          partyName: `Adjustment: ${a.notes || a.type}`,
          user: a.userName || 'Supervisor',
          labStatus: 'RECONCILED',
          isLabRejected: false,
          notes: a.notes || 'Stock Reconciliation',
          compositeComment: `Ref: ADJ-${a.id.slice(-6).toUpperCase()} | Type: Adjustment (${isAdd ? '+' : '-'}) | Qty: ${qty} | User: ${a.userName || 'Staff'}`
        });
      });

      // Production Usages (OUT)
      (hData.productionUsages || []).forEach(u => {
        if (u.isCancelled) return;
        const bStatus = String(u.batchStatus || '').toLowerCase();
        const isInProgress = bStatus.includes('progress') || bStatus.includes('running') || bStatus.includes('paused') || bStatus.includes('draft');
        const qty = Number(u.actualUsedQty || u.requiredQty || 0);
        const batchRef = u.batchNumber || 'Prod Batch';
        const rmBatchTaken = u.batchNoTakenFrom || 'RM Lot';

        txList.push({
          id: `usage-${u.id}`,
          date: u.date,
          flow: 'OUT',
          type: 'PROD_USAGE',
          typeLabel: isInProgress ? 'Production Issue (In Progress WIP)' : 'Production Consumption',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: batchRef,
          batchId: u.batchId,
          batchStatus: isInProgress ? 'IN_PROGRESS' : 'COMPLETED',
          isInProgress,
          rawBatchStatus: u.batchStatus,
          batchNumber: rmBatchTaken,
          partyName: `Product: ${u.productName}`,
          user: 'Production Team',
          labStatus: 'QC_PASSED',
          isLabRejected: false,
          notes: `Status: ${u.batchStatus || 'Completed'}`,
          compositeComment: `Batch: ${batchRef} | RM Lot: ${rmBatchTaken} | Product: ${u.productName} | Qty: ${qty} | Status: ${u.batchStatus || 'Completed'}`
        });
      });

      // Resale / Dispatches (OUT)
      (hData.resales || []).forEach(r => {
        const qty = Number(r.quantity || 0);
        txList.push({
          id: `resale-${r.id}`,
          date: r.orderDate,
          flow: 'OUT',
          type: 'RESALE',
          typeLabel: 'Direct Resale / Dispatch',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: r.docNo || r.referenceNo || 'SO',
          orderId: r.orderId,
          batchNumber: r.batchNo || 'Direct Stock',
          partyName: `Customer: ${r.customerName}`,
          user: 'Sales Team',
          labStatus: 'DISPATCHED',
          isLabRejected: false,
          notes: `${r.docType}: ${r.status}`,
          compositeComment: `Order: ${r.docNo || 'SO'} | Customer: ${r.customerName} | Qty: ${qty}`
        });
      });

      // RM Wastage (OUT)
      (hData.wasteRecords || []).forEach(w => {
        const qty = Number(w.quantity || 0);
        txList.push({
          id: `waste-${w.id}`,
          date: w.date,
          flow: 'OUT',
          type: 'WASTE',
          typeLabel: 'RM Scrap / Wastage',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: w.referenceNo || 'WASTE',
          batchNumber: w.batchNumber || '—',
          partyName: `Wastage: ${w.remarks || w.notes || 'Scrap'}`,
          user: w.responsiblePerson || 'Store Staff',
          labStatus: 'SCRAP_DISCARD',
          isLabRejected: false,
          notes: w.remarks || w.notes,
          compositeComment: `Scrap Ref: ${w.referenceNo || 'WASTE'} | Qty: ${qty} | Reason: ${w.remarks || 'Scrap'}`
        });
      });

      // Purchase Returns (OUT)
      (hData.purchaseReturns || []).forEach(ret => {
        const isLabRejected = String(ret.returnReason || '').toUpperCase().includes('LAB');
        const qty = Number(ret.returnQty || 0);
        txList.push({
          id: `ret-${ret.id}`,
          date: ret.returnDate,
          flow: 'OUT',
          type: 'RETURN',
          typeLabel: isLabRejected ? 'Purchase Return (Lab Rejected)' : 'Purchase Return to Vendor',
          quantity: qty,
          rate: 0,
          amount: 0,
          referenceNo: ret.referenceNo || 'RETURN',
          poReferenceNo: ret.poReferenceNo,
          poId: ret.poId,
          grnId: ret.grnId,
          batchNumber: 'Vendor Return',
          partyName: `Return: ${ret.supplierName}`,
          user: ret.createdByName || 'Staff',
          labStatus: isLabRejected ? 'LAB_REJECTED' : 'VENDOR_RETURN',
          isLabRejected,
          rejectedQty: isLabRejected ? qty : 0,
          rejectionReason: ret.returnReason,
          notes: ret.returnReason,
          compositeComment: `Return Ref: ${ret.referenceNo || 'RETURN'} | PO: ${ret.poReferenceNo || 'N/A'} | Qty: ${qty} | Reason: ${ret.returnReason}`
        });
      });

      txList.sort((a, b) => new Date(b.date) - new Date(a.date));

      const updatedCache = {
        ...materialHistoryCache,
        [matId]: { hData, txList }
      };
      setMaterialHistoryCache(updatedCache);
      return { hData, txList };
    } catch (e) {
      console.error('Failed to load item history for:', matId, e);
      return null;
    } finally {
      setExpandedLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(matId);
        return next;
      });
    }
  }, [materialHistoryCache]);

  // Toggle row expansion and load history on demand
  const toggleExpandRow = async (matId) => {
    setExpandedMaterialIds(prev => {
      const next = new Set(prev);
      if (next.has(matId)) {
        next.delete(matId);
      } else {
        next.add(matId);
      }
      return next;
    });

    if (!materialHistoryCache[matId] && !dedicatedData?.materials?.find(m => m.id === matId)?.transactions?.length) {
      await fetchItemHistory(matId);
    }
  };

  // Merge Base Stock with Dedicated Data
  const unifiedMaterials = useMemo(() => {
    if (dedicatedData?.materials && dedicatedData.materials.length > 0) {
      return dedicatedData.materials;
    }

    return baseStock.map(item => {
      const curStock = Number(item.availableQuantity ?? item.currentStock ?? item.stock ?? 0);
      const alert = Number(item.alertLevel || 0);
      const rate = Number(item.rateWithTax || item.ratePerUnit || item.masterStandardRate || 0);
      const val = Number(item.valueWithTax || item.value || (curStock * rate) || 0);

      const cached = materialHistoryCache[item.id];
      let periodIn = 0;
      let periodOut = 0;
      let inProgressStock = 0;
      let labRejectedQty = 0;
      let hasLabRejection = false;
      let lastIn = null;
      let lastOut = null;
      let txs = [];

      if (cached?.txList) {
        cached.txList.forEach(tx => {
          const inRange = isDateInPeriod(tx.date);
          if (tx.isLabRejected) {
            hasLabRejection = true;
            labRejectedQty += Number(tx.quantity || 0);
          }
          if (tx.flow === 'IN') {
            if (!lastIn || new Date(tx.date) > new Date(lastIn.date)) {
              lastIn = { date: tx.date, ref: tx.referenceNo, qty: tx.quantity, party: tx.partyName, poId: tx.poId, grnId: tx.grnId };
            }
            if (inRange) periodIn += tx.quantity;
          } else {
            if (!lastOut || new Date(tx.date) > new Date(lastOut.date)) {
              lastOut = { date: tx.date, ref: tx.referenceNo, qty: tx.quantity, party: tx.partyName, batchId: tx.batchId, isInProgress: tx.isInProgress };
            }
            if (inRange) periodOut += tx.quantity;
            if (tx.isInProgress) {
              inProgressStock += tx.quantity;
            }
          }

          if (inRange) {
            txs.push(tx);
          }
        });
      }

      const availableStock = Math.max(0, curStock - inProgressStock);
      const status = curStock <= 0 ? 'OUT_OF_STOCK' : (curStock <= alert ? 'LOW_STOCK' : 'OPTIMAL');

      return {
        id: item.id,
        code: item.code || '—',
        name: item.name || '—',
        category: item.category || 'Uncategorised',
        categoryId: item.categoryId,
        uom: item.unit || 'Unit',
        currentStock: curStock,
        inProgressStock: Math.round(inProgressStock * 100) / 100,
        availableStock: Math.round(availableStock * 100) / 100,
        labRejectedQty: Math.round(labRejectedQty * 100) / 100,
        hasLabRejection,
        labStatus: hasLabRejection ? 'LAB_REJECTED' : 'QC_PASSED',
        alertLevel: alert,
        ratePerUnit: Math.round(rate * 100) / 100,
        valuation: Math.round(val * 100) / 100,
        status,
        hasPo: Boolean(item.hasPo || item.poReferenceNo),
        poReferenceNo: item.poReferenceNo || null,
        latestPoId: item.latestPoId || null,
        periodInQty: Math.round(periodIn * 100) / 100,
        periodOutQty: Math.round(periodOut * 100) / 100,
        netMovement: Math.round((periodIn - periodOut) * 100) / 100,
        transactions: txs,
        lastIn: lastIn || (item.poDate ? { date: item.poDate, ref: item.poReferenceNo, qty: item.poLineQty, party: 'Purchase Order' } : null),
        lastOut
      };
    });
  }, [baseStock, dedicatedData, materialHistoryCache, isDateInPeriod]);

  // Overall Global Transactions List
  const unifiedAllTransactions = useMemo(() => {
    if (dedicatedData?.allTransactions && dedicatedData.allTransactions.length > 0) {
      return dedicatedData.allTransactions;
    }

    const flat = [];
    Object.values(materialHistoryCache).forEach(entry => {
      (entry.txList || []).forEach(tx => {
        if (isDateInPeriod(tx.date)) {
          flat.push(tx);
        }
      });
    });
    flat.sort((a, b) => new Date(b.date) - new Date(a.date));
    return flat;
  }, [dedicatedData, materialHistoryCache, isDateInPeriod]);

  // Overall Summary Metrics
  const summary = useMemo(() => {
    if (dedicatedData?.summary) {
      return dedicatedData.summary;
    }

    let totStock = 0;
    let totVal = 0;
    let totIn = 0;
    let totOut = 0;
    let totWip = 0;
    let totAvail = 0;
    let totRejected = 0;
    let rejectedCount = 0;
    let activeCount = 0;

    unifiedMaterials.forEach(m => {
      const cur = Number(m.currentStock || 0);
      const wip = Number(m.inProgressStock || 0);
      const avail = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);

      totStock += cur;
      totVal += Number(m.valuation || 0);
      totIn += Number(m.periodInQty || 0);
      totOut += Number(m.periodOutQty || 0);
      totWip += wip;
      totAvail += avail;
      totRejected += Number(m.labRejectedQty || 0);
      if (m.hasLabRejection) rejectedCount++;

      if (Number(m.periodInQty || 0) > 0 || Number(m.periodOutQty || 0) > 0) {
        activeCount++;
      }
    });

    return {
      totalMaterials: unifiedMaterials.length,
      totalCurrentStock: Math.round(totStock * 100) / 100,
      totalInProgressStock: Math.round(totWip * 100) / 100,
      totalAvailableStock: Math.round(totAvail * 100) / 100,
      totalPeriodIn: Math.round(totIn * 100) / 100,
      totalPeriodOut: Math.round(totOut * 100) / 100,
      totalLabRejectedQty: Math.round(totRejected * 100) / 100,
      totalLabRejectedCount: rejectedCount,
      netMovement: Math.round((totIn - totOut) * 100) / 100,
      totalValuation: Math.round(totVal * 100) / 100,
      activeMovementCount: activeCount
    };
  }, [dedicatedData, unifiedMaterials]);

  // Distinct Categories for Searchable Dropdown
  const categoryOptions = useMemo(() => {
    const counts = {};
    unifiedMaterials.forEach(item => {
      const cat = item.category || 'Uncategorised';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const list = Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map(cat => ({
        value: cat,
        label: cat,
        subLabel: `${counts[cat]} materials`,
        badge: counts[cat]
      }));

    return [
      { value: 'ALL', label: `All Categories (${unifiedMaterials.length})`, badge: unifiedMaterials.length },
      ...list
    ];
  }, [unifiedMaterials]);

  // Distinct RM Codes for Searchable Dropdown
  const codeOptions = useMemo(() => {
    const list = unifiedMaterials.map(item => ({
      value: item.code,
      label: item.code,
      subLabel: `${item.name} (${item.category || 'Uncategorised'})`,
      badge: `${item.currentStock} ${item.uom}`
    }));

    return [
      { value: 'ALL', label: `All RM Codes (${unifiedMaterials.length})`, badge: unifiedMaterials.length },
      ...list
    ];
  }, [unifiedMaterials]);

  // Sync state with URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (period !== 'this_month') params.set('period', period);
    if (period === 'custom') {
      if (appliedCustomStart) params.set('startDate', appliedCustomStart);
      if (appliedCustomEnd) params.set('endDate', appliedCustomEnd);
    }
    if (searchTerm) params.set('search', searchTerm);
    if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
    if (codeFilter !== 'ALL') params.set('code', codeFilter);
    setSearchParams(params, { replace: true });
  }, [period, appliedCustomStart, appliedCustomEnd, searchTerm, categoryFilter, codeFilter, setSearchParams]);

  // Reset pagination on filter or view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, codeFilter, movementFilter, sortBy, period, appliedCustomStart, appliedCustomEnd, viewMode]);

  // Handle Custom Date Range Apply
  const handleApplyCustomRange = (e) => {
    e?.preventDefault();
    if (!customStartDate && !customEndDate) {
      Swal.fire({
        icon: 'warning',
        title: 'Select Dates',
        text: 'Please select a start date and/or end date for the custom period.',
        timer: 3000,
        toast: true,
        position: 'top-end'
      });
      return;
    }
    setPeriod('custom');
    setAppliedCustomStart(customStartDate);
    setAppliedCustomEnd(customEndDate);
  };

  // Universal Column Sorting Handler (Toggles ASC / DESC or changes field)
  const handleColumnSort = (field) => {
    setSortBy(prev => {
      if (prev === `${field}_asc`) return `${field}_desc`;
      if (prev === `${field}_desc`) return `${field}_asc`;
      // Default initial direction: numbers descending, strings ascending
      const defaultDescFields = ['stock', 'wip', 'free', 'in', 'out', 'net', 'valuation', 'amount', 'rate', 'date'];
      return defaultDescFields.includes(field) ? `${field}_desc` : `${field}_asc`;
    });
  };

  // Helper to render sort arrows in table headers
  const renderSortIndicator = (field) => {
    if (sortBy === `${field}_desc`) {
      return <ArrowDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    if (sortBy === `${field}_asc`) {
      return <ArrowUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 shrink-0 transition-opacity" />;
  };

  // Filtered & Sorted Materials
  const filteredMaterials = useMemo(() => {
    let result = unifiedMaterials.filter(item => {
      // 1. Text Search across multiple dimensions
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesTerm = (
          (item.code || '').toLowerCase().includes(term) ||
          (item.name || '').toLowerCase().includes(term) ||
          (item.category || '').toLowerCase().includes(term) ||
          (item.poReferenceNo || '').toLowerCase().includes(term) ||
          (item.lastIn?.ref || '').toLowerCase().includes(term) ||
          (item.lastOut?.ref || '').toLowerCase().includes(term) ||
          (item.transactions || []).some(t =>
            (t.referenceNo || '').toLowerCase().includes(term) ||
            (t.batchNumber || '').toLowerCase().includes(term) ||
            (t.partyName || '').toLowerCase().includes(term) ||
            (t.compositeComment || '').toLowerCase().includes(term)
          )
        );
        if (!matchesTerm) return false;
      }

      // 2. Category Dropdown Filter
      if (categoryFilter !== 'ALL') {
        if ((item.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. RM Code Dropdown Filter
      if (codeFilter !== 'ALL') {
        if (item.code !== codeFilter) return false;
      }

      // 4. Movement & Status Filters (Interactive from KPI Cards & Charts)
      if (movementFilter === 'IN_PROGRESS') {
        if (Number(item.inProgressStock || 0) <= 0) return false;
      } else if (movementFilter === 'FREE_AVAILABLE') {
        if (Number(item.availableStock !== undefined ? item.availableStock : Math.max(0, (item.currentStock || 0) - (item.inProgressStock || 0))) <= 0) return false;
      } else if (movementFilter === 'LAB_REJECTED') {
        if (!item.hasLabRejection && item.labStatus !== 'LAB_REJECTED') return false;
      } else if (movementFilter === 'WITH_MOVEMENT') {
        if (Number(item.periodInQty || 0) === 0 && Number(item.periodOutQty || 0) === 0) return false;
      } else if (movementFilter === 'IN_ONLY') {
        if (Number(item.periodInQty || 0) <= 0) return false;
      } else if (movementFilter === 'OUT_ONLY') {
        if (Number(item.periodOutQty || 0) <= 0) return false;
      } else if (movementFilter === 'NET_POSITIVE') {
        if (Number(item.netMovement || 0) <= 0) return false;
      } else if (movementFilter === 'NET_NEGATIVE') {
        if (Number(item.netMovement || 0) >= 0) return false;
      } else if (movementFilter === 'LOW_STOCK') {
        if (item.status !== 'LOW_STOCK') return false;
      } else if (movementFilter === 'OUT_OF_STOCK') {
        if (item.status !== 'OUT_OF_STOCK') return false;
      }

      return true;
    });

    // Dynamic Multi-Field Sorting
    result.sort((a, b) => {
      // Code
      if (sortBy === 'code_asc') return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'code_desc') return (b.code || '').localeCompare(a.code || '', undefined, { numeric: true, sensitivity: 'base' });

      // Name
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });

      // Category
      if (sortBy === 'category_asc') return (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' });
      if (sortBy === 'category_desc') return (b.category || '').localeCompare(a.category || '', undefined, { sensitivity: 'base' });

      // In-Hand Stock
      if (sortBy === 'stock_desc') return Number(b.currentStock || 0) - Number(a.currentStock || 0);
      if (sortBy === 'stock_asc') return Number(a.currentStock || 0) - Number(b.currentStock || 0);

      // Floor WIP
      if (sortBy === 'wip_desc') return Number(b.inProgressStock || 0) - Number(a.inProgressStock || 0);
      if (sortBy === 'wip_asc') return Number(a.inProgressStock || 0) - Number(b.inProgressStock || 0);

      // Free Available
      if (sortBy === 'free_desc') return Number(b.availableStock || 0) - Number(a.availableStock || 0);
      if (sortBy === 'free_asc') return Number(a.availableStock || 0) - Number(b.availableStock || 0);

      // Period Inward
      if (sortBy === 'in_desc') return Number(b.periodInQty || 0) - Number(a.periodInQty || 0);
      if (sortBy === 'in_asc') return Number(a.periodInQty || 0) - Number(b.periodInQty || 0);

      // Period Outward
      if (sortBy === 'out_desc') return Number(b.periodOutQty || 0) - Number(a.periodOutQty || 0);
      if (sortBy === 'out_asc') return Number(a.periodOutQty || 0) - Number(b.periodOutQty || 0);

      // Net Movement
      if (sortBy === 'net_desc') return Number(b.netMovement || 0) - Number(a.netMovement || 0);
      if (sortBy === 'net_asc') return Number(a.netMovement || 0) - Number(b.netMovement || 0);

      // Valuation
      if (sortBy === 'valuation_desc') return Number(b.valuation || 0) - Number(a.valuation || 0);
      if (sortBy === 'valuation_asc') return Number(a.valuation || 0) - Number(b.valuation || 0);

      // Rate
      if (sortBy === 'rate_desc') return Number(b.ratePerUnit || 0) - Number(a.ratePerUnit || 0);
      if (sortBy === 'rate_asc') return Number(a.ratePerUnit || 0) - Number(b.ratePerUnit || 0);

      // QC Status (Rejections first)
      if (sortBy === 'qc_desc') return (b.hasLabRejection ? 1 : 0) - (a.hasLabRejection ? 1 : 0);
      if (sortBy === 'qc_asc') return (a.hasLabRejection ? 1 : 0) - (b.hasLabRejection ? 1 : 0);

      return 0;
    });

    return result;
  }, [unifiedMaterials, searchTerm, categoryFilter, codeFilter, movementFilter, sortBy]);

  // Filtered Date-Wise Ledger Transactions
  const filteredTransactions = useMemo(() => {
    let result = unifiedAllTransactions.filter(tx => {
      // 1. Keyword search
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesTerm = (
          (tx.rawMaterialCode || '').toLowerCase().includes(term) ||
          (tx.rawMaterialName || '').toLowerCase().includes(term) ||
          (tx.category || '').toLowerCase().includes(term) ||
          (tx.referenceNo || '').toLowerCase().includes(term) ||
          (tx.poReferenceNo || '').toLowerCase().includes(term) ||
          (tx.batchNumber || '').toLowerCase().includes(term) ||
          (tx.partyName || '').toLowerCase().includes(term) ||
          (tx.user || '').toLowerCase().includes(term) ||
          (tx.notes || '').toLowerCase().includes(term) ||
          (tx.compositeComment || '').toLowerCase().includes(term)
        );
        if (!matchesTerm) return false;
      }

      // 2. Category Dropdown
      if (categoryFilter !== 'ALL') {
        if ((tx.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. RM Code Dropdown
      if (codeFilter !== 'ALL') {
        if (tx.rawMaterialCode !== codeFilter) return false;
      }

      // 4. Movement Filter
      if (movementFilter === 'IN_PROGRESS') {
        if (!tx.isInProgress && tx.batchStatus !== 'IN_PROGRESS') return false;
      } else if (movementFilter === 'LAB_REJECTED') {
        if (!tx.isLabRejected && tx.labStatus !== 'LAB_REJECTED') return false;
      } else if (movementFilter === 'IN_ONLY') {
        if (tx.flow !== 'IN') return false;
      } else if (movementFilter === 'OUT_ONLY') {
        if (tx.flow !== 'OUT') return false;
      }

      return true;
    });

    // Ledger Sorting
    result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'code_asc') return (a.rawMaterialCode || '').localeCompare(b.rawMaterialCode || '', undefined, { numeric: true });
      if (sortBy === 'code_desc') return (b.rawMaterialCode || '').localeCompare(a.rawMaterialCode || '', undefined, { numeric: true });
      if (sortBy === 'name_asc') return (a.rawMaterialName || '').localeCompare(b.rawMaterialName || '');
      if (sortBy === 'name_desc') return (b.rawMaterialName || '').localeCompare(a.rawMaterialName || '');
      if (sortBy === 'ref_asc') return (a.referenceNo || '').localeCompare(b.referenceNo || '');
      if (sortBy === 'ref_desc') return (b.referenceNo || '').localeCompare(a.referenceNo || '');
      if (sortBy === 'batch_asc') return (a.batchNumber || '').localeCompare(b.batchNumber || '');
      if (sortBy === 'batch_desc') return (b.batchNumber || '').localeCompare(a.batchNumber || '');
      if (sortBy === 'in_desc') return (b.flow === 'IN' ? b.quantity : 0) - (a.flow === 'IN' ? a.quantity : 0);
      if (sortBy === 'in_asc') return (a.flow === 'IN' ? a.quantity : 0) - (b.flow === 'IN' ? b.quantity : 0);
      if (sortBy === 'out_desc') return (b.flow === 'OUT' ? b.quantity : 0) - (a.flow === 'OUT' ? a.quantity : 0);
      if (sortBy === 'out_asc') return (a.flow === 'OUT' ? a.quantity : 0) - (b.flow === 'OUT' ? b.quantity : 0);
      if (sortBy === 'rate_desc') return Number(b.rate || 0) - Number(a.rate || 0);
      if (sortBy === 'rate_asc') return Number(a.rate || 0) - Number(b.rate || 0);
      if (sortBy === 'amount_desc') return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === 'amount_asc') return Number(a.amount || 0) - Number(b.amount || 0);
      if (sortBy === 'qc_desc') return (b.isLabRejected ? 1 : 0) - (a.isLabRejected ? 1 : 0);
      if (sortBy === 'qc_asc') return (a.isLabRejected ? 1 : 0) - (b.isLabRejected ? 1 : 0);
      if (sortBy === 'party_asc') return (a.partyName || '').localeCompare(b.partyName || '');
      if (sortBy === 'party_desc') return (b.partyName || '').localeCompare(a.partyName || '');
      return 0;
    });

    return result;
  }, [unifiedAllTransactions, searchTerm, categoryFilter, codeFilter, movementFilter, sortBy]);

  // Pagination for Materials
  const totalMaterialPages = Math.ceil(filteredMaterials.length / itemsPerPage) || 1;
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMaterials.slice(start, start + itemsPerPage);
  }, [filteredMaterials, currentPage, itemsPerPage]);

  // Pagination for Transactions (Ledger View)
  const totalTransactionPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Safe UOM Formatter to prevent any UUID leakage
  const formatUOM = (uom) => {
    if (!uom) return 'Nos';
    const str = String(uom).trim();
    if (/^[0-9a-fA-F-]{32,36}$/.test(str)) {
      return 'Nos';
    }
    return str;
  };

  // Date formatting helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateStr);
    }
  };

  // Helper to format date as DD-MM-YYYY (matching user's Excel column headers)
  const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '';
    }
  };

  const parseDDMMYYYY = (str) => {
    if (!str) return 0;
    const parts = str.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    }
    return 0;
  };

  // Distinct movement dates in DD-MM-YYYY format across all transactions, chronologically sorted
  const matrixDates = useMemo(() => {
    const dateMap = new Map();
    unifiedAllTransactions.forEach(tx => {
      if (tx.date) {
        const dStr = formatDDMMYYYY(tx.date);
        if (dStr && !dateMap.has(dStr)) {
          dateMap.set(dStr, parseDDMMYYYY(dStr));
        }
      }
    });

    return Array.from(dateMap.keys()).sort((a, b) => dateMap.get(a) - dateMap.get(b));
  }, [unifiedAllTransactions]);

  // Movement Matrix Map: rawMaterialId -> dateStr -> { inQty, outQty, transactions: [] }
  const matrixData = useMemo(() => {
    const map = {};

    filteredMaterials.forEach(m => {
      map[m.id] = {};
      matrixDates.forEach(dStr => {
        map[m.id][dStr] = { inQty: 0, outQty: 0, transactions: [] };
      });
    });

    unifiedAllTransactions.forEach(tx => {
      const rmId = tx.rawMaterialId;
      const dStr = formatDDMMYYYY(tx.date);
      if (map[rmId] && map[rmId][dStr]) {
        const qty = Number(tx.quantity || 0);
        if (tx.flow === 'IN') {
          map[rmId][dStr].inQty += qty;
        } else {
          map[rmId][dStr].outQty += qty;
        }
        map[rmId][dStr].transactions.push(tx);
      }
    });

    return map;
  }, [filteredMaterials, unifiedAllTransactions, matrixDates]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  // Open Full History Drawer
  const handleOpenHistory = (matId, tab = 'timeline') => {
    setSelectedMaterialId(matId);
    setHistoryInitialTab(tab);
    setIsHistoryOpen(true);
  };

  // Open Stock Query Modal
  const handleOpenStockQuery = (matId) => {
    setSelectedStockQueryId(matId);
    setIsStockQueryOpen(true);
  };

  // Redirection handler for PO
  const handleRedirectToPO = (poId, poRef) => {
    if (poId) {
      navigate(`/purchase-orders/${poId}`);
    } else if (poRef) {
      navigate(`/purchase-orders?search=${encodeURIComponent(poRef)}`);
    } else {
      navigate('/purchase-orders');
    }
  };

  // Redirection handler for GRN
  const handleRedirectToGRN = (grnId, grnRef) => {
    if (grnId) {
      navigate(`/grn/view/${grnId}`);
    } else if (grnRef) {
      navigate(`/grn/list?search=${encodeURIComponent(grnRef)}`);
    } else {
      navigate('/grn/list');
    }
  };

  // Redirection handler for Production Batch
  const handleRedirectToBatch = (batchId, batchNo) => {
    navigate('/production/standard');
  };

  // =========================================================================
  // EXPORT ENGINE (2 Dedicated Types + Master Multi-Sheet Workbook)
  // =========================================================================

  // Build Summary Rows
  const generateSummaryExportRows = useCallback(() => {
    return filteredMaterials.map(m => {
      const cur = Number(m.currentStock || 0);
      const wip = Number(m.inProgressStock || 0);
      const free = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);
      const rate = Number(m.ratePerUnit || 0);
      const val = Number(m.valuation || 0);
      const poRef = m.poReferenceNo || 'N/A';
      const lastInBatch = m.lastIn?.ref || 'N/A';
      const qcStatus = m.hasLabRejection ? '❌ LAB REJECTED' : 'APPROVED / QC PASSED';

      const compositeComment = `PO: ${poRef} | Batch: ${lastInBatch} | In-Hand: ${cur} ${m.uom} | WIP: ${wip} | Free: ${free} | Rate: ₹${rate.toFixed(2)} | Valuation: ₹${val.toFixed(2)} | QC: ${qcStatus}`;

      return {
        'RM Code': m.code || '—',
        'Raw Material Name': m.name || '—',
        'Category': m.category || '—',
        'UOM': formatUOM(m.uom),
        'Total Current Stock (In Hand)': cur,
        'In-Progress Stock (Floor WIP)': wip,
        'Available Stock (Free for Orders)': free,
        [`Period Inward IN (${period})`]: m.periodInQty || 0,
        [`Period Outward OUT (${period})`]: m.periodOutQty || 0,
        'Net Movement': m.netMovement || 0,
        'Standard Rate (₹/Unit)': rate,
        'Total Valuation (₹)': val,
        'Stock Status': m.status || 'OPTIMAL',
        'Floor WIP Status': wip > 0 ? 'ACTIVE WIP RUNNING' : 'IDLE',
        'Latest PO Number': poRef,
        'Latest Inward Batch / Ref': lastInBatch,
        'Last Inward Date': m.lastIn ? formatDate(m.lastIn.date) : '—',
        'Last Outward Ref': m.lastOut?.ref || '—',
        'Last Outward Date': m.lastOut ? formatDate(m.lastOut.date) : '—',
        'Lab & Quality Decision': qcStatus,
        'Lab Rejected Quantity': m.labRejectedQty || 0,
        'Audit Comment & Inventory Notes': compositeComment
      };
    });
  }, [filteredMaterials, period]);

  // Build Ledger Rows (includes Supplier Invoice Date & Invoice Number)
  const generateLedgerExportRows = useCallback(() => {
    return filteredTransactions.map(tx => {
      const isIn = tx.flow === 'IN';
      const rate = Number(tx.rate || 0);
      const qty = Number(tx.quantity || 0);
      const amt = Number(tx.amount || (rate * qty) || 0);
      const qcStatus = tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED');
      const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : '—';
      const invNo = tx.supplierInvoiceNo || '—';

      const compositeComment = tx.compositeComment || `PO: ${tx.poReferenceNo || 'N/A'}${invDate !== '—' ? ` | Supplier Inv Date: ${invDate}` : ''}${invNo !== '—' ? ` | Inv No: ${invNo}` : ''} | Batch: ${tx.batchNumber || 'N/A'} | Qty: ${qty} ${tx.uom || ''} | Rate: ₹${rate.toFixed(2)} | Amount: ₹${amt.toFixed(2)} | QC: ${qcStatus}${tx.rejectionReason ? ` | Rejection: ${tx.rejectionReason}` : ''}`;

      return {
        'Date & Time': formatDateTime(tx.date),
        'Flow Direction': tx.flow === 'IN' ? 'INWARD (IN)' : 'OUTWARD (OUT)',
        'Batch Status': tx.isInProgress ? '🟡 IN PROGRESS (WIP)' : 'COMPLETED',
        'Transaction Type': tx.typeLabel || 'Movement',
        'RM Code': tx.rawMaterialCode || '—',
        'Raw Material Name': tx.rawMaterialName || '—',
        'Category': tx.category || '—',
        'UOM': tx.uom || 'Unit',
        'Document Reference': tx.referenceNo || '—',
        'PO Reference': tx.poReferenceNo || '—',
        'Supplier Invoice Date': invDate,
        'Supplier Invoice No': invNo,
        'Batch / Lot Number': tx.batchNumber || '—',
        'Inward Qty (IN)': isIn ? qty : 0,
        'Outward Qty (OUT)': !isIn ? qty : 0,
        'Floor WIP Allocated': tx.isInProgress ? qty : 0,
        'Unit Rate (₹)': rate,
        'Transaction Amount (₹)': amt,
        'Quality & Lab Decision': qcStatus,
        'Rejection / Discrepancy Note': tx.rejectionReason || tx.notes || '—',
        'Supplier / Destination Party': tx.partyName || '—',
        'Handled By / Operator': tx.user || '—',
        'Detailed Audit Comment': compositeComment
      };
    });
  }, [filteredTransactions]);

  // Build Date-Wise Movement Matrix Rows (Matching user's Excel format with Green IN & Red OUT data)
  const generateMatrixExportRows = useCallback(() => {
    return filteredMaterials.map(m => {
      const cur = Number(m.currentStock || 0);
      const wip = Number(m.inProgressStock || 0);
      const free = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);
      const val = Number(m.valuation || 0);

      const row = {
        'RM Code': m.code || '—',
        'Raw Material Name': m.name || '—',
        'Category': m.category || '—',
        'UOM': formatUOM(m.uom),
        'TotalStock': cur,
        'Available Stock': free,
        [`Period Inward IN (${period})`]: Number(m.periodInQty || 0),
        [`Period Outward OUT (${period})`]: Number(m.periodOutQty || 0),
        'Total Valuation (₹)': val
      };

      // Populate dynamic chronological date columns
      matrixDates.forEach(dStr => {
        const cell = matrixData[m.id]?.[dStr];
        if (cell) {
          const hasIn = cell.inQty > 0;
          const hasOut = cell.outQty > 0;
          if (hasIn && hasOut) {
            row[dStr] = `+${cell.inQty} / -${cell.outQty}`;
          } else if (hasIn) {
            row[dStr] = cell.inQty;
          } else if (hasOut) {
            row[dStr] = cell.outQty;
          } else {
            row[dStr] = '';
          }
        } else {
          row[dStr] = '';
        }
      });

      return row;
    });
  }, [filteredMaterials, matrixDates, matrixData, period]);

  // Build Supplier Invoice Inward Audit Rows (Dedicated audit for Supplier Invoice Date e.g. 15 Oct 2026)
  const generateSupplierInvoiceAuditRows = useCallback(() => {
    return unifiedAllTransactions
      .filter(tx => tx.flow === 'IN')
      .map(tx => {
        const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : (tx.date ? formatDate(tx.date) : '—');
        return {
          'Movement Date': formatDate(tx.date),
          'Supplier Invoice Date': invDate,
          'Supplier Invoice No': tx.supplierInvoiceNo || '—',
          'RM Code': tx.rawMaterialCode || '—',
          'Raw Material Name': tx.rawMaterialName || '—',
          'Category': tx.category || '—',
          'Inward Quantity (IN)': Number(tx.quantity || 0),
          'UOM': formatUOM(tx.uom),
          'Document Reference': tx.referenceNo || '—',
          'PO Reference': tx.poReferenceNo || tx.referenceNo || '—',
          'Batch / Lot Number': tx.batchNumber || '—',
          'Unit Rate (₹)': Number(tx.rate || 0),
          'Valuation Amount (₹)': Number(tx.amount || 0),
          'Quality Decision': tx.isLabRejected ? '❌ LAB REJECTED' : (tx.labStatus || 'PASSED'),
          'Supplier / Vendor': tx.partyName || '—',
          'Received By': tx.user || '—'
        };
      });
  }, [unifiedAllTransactions]);

  // Export Trigger: Type 1 (Date-Wise In-Out Matrix Report matching user's Excel format)
  const handleExportMatrixOnly = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportStockInOutMatrixToExcel({
        materials: filteredMaterials,
        matrixDates,
        matrixData,
        period,
        allTransactions: unifiedAllTransactions
      });

      Swal.fire({
        icon: 'success',
        title: 'Stock In-Out Matrix Exported',
        text: `Exported ${filteredMaterials.length} raw materials across ${matrixDates.length} date columns with PO Supplier Invoice audit to ${fileName}`,
        timer: 3500,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export matrix failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  // Export Trigger: Type 2 (Master Summary Only)
  const handleExportSummaryOnly = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportMasterSummaryToExcel({
        materials: filteredMaterials,
        period
      });

      Swal.fire({
        icon: 'success',
        title: 'Master Summary Exported',
        text: `Exported ${filteredMaterials.length} raw material records with Green IN & Red OUT indicators to ${fileName}`,
        timer: 3000,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export summary failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  // Export Trigger: Type 3 (Ledger Only)
  const handleExportLedgerOnly = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportDateWiseLedgerToExcel({
        transactions: filteredTransactions,
        period
      });

      Swal.fire({
        icon: 'success',
        title: 'Date Ledger Exported',
        text: `Exported ${filteredTransactions.length} chronological audit transactions with Green IN & Red OUT indicators to ${fileName}`,
        timer: 3000,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export ledger failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  // Export Trigger: Type 4 (All-in-One Multi-Sheet Master Enterprise Workbook)
  const handleExportCompleteWorkbook = async () => {
    try {
      setIsExportModalOpen(false);
      const fileName = await exportCompleteEnterpriseWorkbookToExcel({
        materials: filteredMaterials,
        matrixDates,
        matrixData,
        period,
        allTransactions: unifiedAllTransactions
      });

      Swal.fire({
        icon: 'success',
        title: 'Master Enterprise Workbook Exported',
        text: `Exported multi-sheet workbook containing Date-Wise Matrix, Summary, Chronological Ledger, and Supplier Invoice audits to ${fileName}`,
        timer: 3500,
        toast: true,
        position: 'top-end',
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Export workbook failed:', err);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.message });
    }
  };

  const isAnyLoading = isBaseLoading;
  const isAnyFetching = isBaseFetching || isDedicatedFetching;

  // Total volume moved for visual distribution chart calculation
  const totalVolumeCalculated = useMemo(() => {
    return Math.max(1, (summary.totalPeriodIn || 0) + (summary.totalPeriodOut || 0) + (summary.totalInProgressStock || 0));
  }, [summary]);

  return (
    <div className="w-full min-h-screen bg-slate-50/70 dark:bg-slate-950 px-2 sm:px-4 py-2 sm:py-3 space-y-2.5 transition-colors">
      {/* ── TOP HEADER & ACTIONS (High-Density Bar with Auto-Refresh & No Refresh Button) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Boxes className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              RM-IN-OUT Stock
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              Stock In & Out Ledger
            </span>

            {/* Interactive Header WIP Badge - Clickable to Filter */}
            {summary.totalInProgressStock > 0 && (
              <button
                type="button"
                onClick={() => setMovementFilter(movementFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition-all cursor-pointer ${
                  movementFilter === 'IN_PROGRESS'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                    : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                }`}
                title="Click to filter by Floor WIP Run"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${movementFilter === 'IN_PROGRESS' ? 'bg-white' : 'bg-amber-500'} animate-pulse`} />
                <span>Floor WIP: {summary.totalInProgressStock}</span>
              </button>
            )}

            {/* Interactive Header Lab Rejected Badge - Clickable to Filter */}
            {summary.totalLabRejectedCount > 0 && (
              <button
                type="button"
                onClick={() => setMovementFilter(movementFilter === 'LAB_REJECTED' ? 'ALL' : 'LAB_REJECTED')}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition-all cursor-pointer ${
                  movementFilter === 'LAB_REJECTED'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-300'
                    : 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                }`}
                title="Click to filter by Lab Rejections"
              >
                <AlertOctagon className="w-3 h-3 text-rose-600" />
                <span>Lab Rejected: {summary.totalLabRejectedCount} Items</span>
              </button>
            )}

            {/* Live Auto-Refresh Indicator Pulse */}
            {isAnyFetching && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium animate-pulse ml-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Auto-refreshing...</span>
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Raw material date-wise inward, outward, production consumption, adjustments & live stock audit
          </p>
        </div>

        {/* View Switcher, Density & Export Actions (Refresh button removed per request) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => { setViewMode('ledger'); setLedgerSubMode('matrix'); }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                viewMode === 'ledger' && ledgerSubMode === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Date-Wise Movement Matrix</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                viewMode === 'ledger' && ledgerSubMode === 'matrix' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {matrixDates.length} Dates
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('material')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                viewMode === 'material'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Material Summary</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('ledger'); setLedgerSubMode('stream'); }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all text-xs cursor-pointer ${
                viewMode === 'ledger' && ledgerSubMode === 'stream'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Transaction Stream</span>
            </button>
          </div>

          {/* Density Toggle */}
          <button
            onClick={() => setIsCompactDensity(!isCompactDensity)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            title={isCompactDensity ? 'Switch to Comfortable View' : 'Switch to Compact ERP View'}
          >
            <TableProperties className="w-4 h-4" />
          </button>

          {/* Export Report Trigger */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
          </Button>
        </div>
      </div>

      {/* ── TIME PERIOD FILTER BAR (Single-Line Compact Strip) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 shadow-2xs space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Time Period:
            </span>
          </div>

          {/* Fast Period Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'last_week', label: 'Last Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Date Range' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriod(p.id);
                  if (p.id !== 'custom') {
                    setAppliedCustomStart('');
                    setAppliedCustomEnd('');
                  }
                }}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Form (Appears when 'custom' is active) */}
        {period === 'custom' && (
          <form
            onSubmit={handleApplyCustomRange}
            className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-2 animate-in fade-in duration-150"
          >
            <div>
              <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                From Date:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                To Date:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 cursor-pointer"
              >
                Apply Range
              </Button>
              {(appliedCustomStart || appliedCustomEnd) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setAppliedCustomStart('');
                    setAppliedCustomEnd('');
                    setPeriod('this_month');
                  }}
                  className="text-xs h-8 px-2.5 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* ── KPI EXECUTIVE STAT CARDS (Interactive Click-to-Filter enabled) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {/* Card 1: Total Current Stock (Click to show All / Reset) */}
        <Card
          onClick={() => setMovementFilter('ALL')}
          className={`border transition-all cursor-pointer hover:shadow-md ${
            movementFilter === 'ALL'
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
          title="Click to view all raw materials"
        >
          <CardContent className="p-2.5 sm:p-3 space-y-0.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="font-medium">Total Current Stock</span>
              <Package className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
              {Number(summary.totalCurrentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
              <span>Valuation:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                ₹{Number(summary.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: In-Progress WIP (Click to filter WIP) */}
        <Card
          onClick={() => setMovementFilter(movementFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          className={`border transition-all cursor-pointer hover:shadow-md ${
            movementFilter === 'IN_PROGRESS'
              ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-100/70 dark:bg-amber-950/40 shadow-xs'
              : 'border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-400'
          }`}
          title="Click to filter materials running on floor WIP"
        >
          <CardContent className="p-2.5 sm:p-3 space-y-0.5">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 text-[11px]">
              <span className="font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                In-Progress WIP
              </span>
              <Factory className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-300 font-mono">
              {Number(summary.totalInProgressStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 truncate flex items-center justify-between">
              <span>Active floor batches</span>
              {movementFilter === 'IN_PROGRESS' && <span className="font-bold text-[9px] text-amber-800">Filtered</span>}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Free Available Stock (Click to filter available) */}
        <Card
          onClick={() => setMovementFilter(movementFilter === 'FREE_AVAILABLE' ? 'ALL' : 'FREE_AVAILABLE')}
          className={`border transition-all cursor-pointer hover:shadow-md ${
            movementFilter === 'FREE_AVAILABLE'
              ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-100/70 dark:bg-emerald-950/40 shadow-xs'
              : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-300'
          }`}
          title="Click to filter materials with free available stock"
        >
          <CardContent className="p-2.5 sm:p-3 space-y-0.5">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[11px]">
              <span className="font-semibold">Free Available</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">
              {Number(summary.totalAvailableStock !== undefined ? summary.totalAvailableStock : Math.max(0, (summary.totalCurrentStock || 0) - (summary.totalInProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 truncate flex items-center justify-between">
              <span>Ready for orders</span>
              {movementFilter === 'FREE_AVAILABLE' && <span className="font-bold text-[9px]">Filtered</span>}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Period Inward (IN) (Click to filter Inward receipts) */}
        <Card
          onClick={() => setMovementFilter(movementFilter === 'IN_ONLY' ? 'ALL' : 'IN_ONLY')}
          className={`border transition-all cursor-pointer hover:shadow-md ${
            movementFilter === 'IN_ONLY'
              ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300'
          }`}
          title="Click to filter materials with Inward receipts in this period"
        >
          <CardContent className="p-2.5 sm:p-3 space-y-0.5">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[11px]">
              <span className="font-semibold">Period Inward (IN)</span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">
              +{Number(summary.totalPeriodIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 truncate flex items-center justify-between">
              <span>GRN receipts</span>
              {movementFilter === 'IN_ONLY' && <span className="font-bold text-[9px] text-emerald-600">Filtered</span>}
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Period Outward (OUT) (Click to filter Outward consumption) */}
        <Card
          onClick={() => setMovementFilter(movementFilter === 'OUT_ONLY' ? 'ALL' : 'OUT_ONLY')}
          className={`border transition-all cursor-pointer hover:shadow-md ${
            movementFilter === 'OUT_ONLY'
              ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/70 dark:bg-rose-950/40 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300'
          }`}
          title="Click to filter materials consumed/dispatched outward"
        >
          <CardContent className="p-2.5 sm:p-3 space-y-0.5">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-[11px]">
              <span className="font-semibold">Period Outward (OUT)</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-300 font-mono">
              -{Number(summary.totalPeriodOut || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 truncate flex items-center justify-between">
              <span>Prod & sales waste</span>
              {movementFilter === 'OUT_ONLY' && <span className="font-bold text-[9px] text-rose-600">Filtered</span>}
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Net Movement (Click to filter movement) */}
        <Card
          onClick={() => setMovementFilter(movementFilter === 'WITH_MOVEMENT' ? 'ALL' : 'WITH_MOVEMENT')}
          className={`border transition-all cursor-pointer hover:shadow-md ${
            movementFilter === 'WITH_MOVEMENT'
              ? 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300'
          }`}
          title="Click to filter materials with active movement in period"
        >
          <CardContent className="p-2.5 sm:p-3 space-y-0.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="font-medium">Net Movement</span>
              {Number(summary.netMovement || 0) >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              )}
            </div>
            <div className={`text-base sm:text-lg font-bold font-mono ${
              Number(summary.netMovement || 0) >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {Number(summary.netMovement || 0) > 0 ? '+' : ''}
              {Number(summary.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 truncate flex items-center justify-between">
              <span>{summary.activeMovementCount || 0} / {summary.totalMaterials || 0} active</span>
              {movementFilter === 'WITH_MOVEMENT' && <span className="font-bold text-[9px] text-purple-600">Filtered</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── INTERACTIVE VISUAL STOCK FLOW BAR (Click any segment to filter) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Interactive Movement Breakdown (Click to filter table):</span>
          </div>
          {movementFilter !== 'ALL' && (
            <button
              onClick={() => setMovementFilter('ALL')}
              className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
            >
              <span>Reset filter ({movementFilter})</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex cursor-pointer shadow-inner">
          {/* Segment 1: Inward (Green) */}
          <div
            onClick={() => setMovementFilter('IN_ONLY')}
            style={{ width: `${Math.max(5, ((summary.totalPeriodIn || 0) / totalVolumeCalculated) * 100)}%` }}
            className={`h-full bg-emerald-500 hover:bg-emerald-600 transition-all ${movementFilter === 'IN_ONLY' ? 'ring-2 ring-white z-10' : ''}`}
            title={`Period Inward: +${summary.totalPeriodIn} (Click to filter)`}
          />
          {/* Segment 2: Outward (Red) */}
          <div
            onClick={() => setMovementFilter('OUT_ONLY')}
            style={{ width: `${Math.max(3, ((summary.totalPeriodOut || 0) / totalVolumeCalculated) * 100)}%` }}
            className={`h-full bg-rose-500 hover:bg-rose-600 transition-all ${movementFilter === 'OUT_ONLY' ? 'ring-2 ring-white z-10' : ''}`}
            title={`Period Outward: -${summary.totalPeriodOut} (Click to filter)`}
          />
          {/* Segment 3: Floor WIP (Amber) */}
          <div
            onClick={() => setMovementFilter('IN_PROGRESS')}
            style={{ width: `${Math.max(3, ((summary.totalInProgressStock || 0) / totalVolumeCalculated) * 100)}%` }}
            className={`h-full bg-amber-400 hover:bg-amber-500 transition-all ${movementFilter === 'IN_PROGRESS' ? 'ring-2 ring-white z-10' : ''}`}
            title={`Floor WIP: ${summary.totalInProgressStock} (Click to filter)`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2 pt-0.5">
          <div className="flex items-center gap-3">
            <span onClick={() => setMovementFilter('IN_ONLY')} className="flex items-center gap-1 cursor-pointer hover:text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Inward ({summary.totalPeriodIn})</span>
            </span>
            <span onClick={() => setMovementFilter('OUT_ONLY')} className="flex items-center gap-1 cursor-pointer hover:text-rose-600">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Outward ({summary.totalPeriodOut})</span>
            </span>
            <span onClick={() => setMovementFilter('IN_PROGRESS')} className="flex items-center gap-1 cursor-pointer hover:text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Floor WIP ({summary.totalInProgressStock})</span>
            </span>
          </div>
          <div>
            Total Monitored Volume: <strong className="font-mono text-slate-700 dark:text-slate-300">{Number(totalVolumeCalculated).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</strong>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR: SEARCH, SEARCHABLE CATEGORY, SEARCHABLE CODE & STATUS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {/* 1. Global Text Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword, PO, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 outline-hidden"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Searchable Category Dropdown with internal Search Bar */}
          <SearchableFilterDropdown
            label="Category"
            placeholder="All Categories"
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            options={categoryOptions}
            icon={Layers}
          />

          {/* 3. Searchable RM Code Dropdown with internal Search Bar */}
          <SearchableFilterDropdown
            label="RM Code"
            placeholder="All RM Codes"
            value={codeFilter}
            onChange={(val) => setCodeFilter(val)}
            options={codeOptions}
            icon={Package}
          />

          {/* 4. Movement / Stock Filter */}
          <div>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Movement Status</option>
              <option value="IN_PROGRESS">🟡 In-Progress WIP (Floor Runs)</option>
              <option value="FREE_AVAILABLE">🟢 Free Available Stock (&gt; 0)</option>
              <option value="LAB_REJECTED">❌ Lab Rejected / QC Discrepancies</option>
              <option value="WITH_MOVEMENT">With Movement In Period</option>
              <option value="IN_ONLY">Inward Only (IN &gt; 0)</option>
              <option value="OUT_ONLY">Outward Only (OUT &gt; 0)</option>
              <option value="NET_POSITIVE">Net Positive (+ Movement)</option>
              <option value="NET_NEGATIVE">Net Drawdown (- Movement)</option>
              <option value="LOW_STOCK">Low Stock Warning</option>
              <option value="OUT_OF_STOCK">Out of Stock (Zero)</option>
            </select>
          </div>

          {/* 5. Sorting Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 outline-hidden cursor-pointer"
            >
              <option value="code_asc">Code (RM-00001 First)</option>
              <option value="code_desc">Code (Descending)</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="category_asc">Category (A → Z)</option>
              <option value="stock_desc">In-Hand Stock (High → Low)</option>
              <option value="stock_asc">In-Hand Stock (Low → High)</option>
              <option value="wip_desc">In-Progress WIP (High → Low)</option>
              <option value="free_desc">Free Stock (High → Low)</option>
              <option value="in_desc">Period IN (High → Low)</option>
              <option value="out_desc">Period OUT (High → Low)</option>
              <option value="net_desc">Net Movement (+ to -)</option>
              <option value="valuation_desc">Valuation (High → Low)</option>
              <option value="rate_desc">Standard Rate (High → Low)</option>
              <option value="qc_desc">QC Rejections First</option>
            </select>

            {(searchTerm || categoryFilter !== 'ALL' || codeFilter !== 'ALL' || movementFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('ALL');
                  setCodeFilter('ALL');
                  setMovementFilter('ALL');
                  setSortBy('code_asc');
                }}
                className="h-8 px-2 text-xs border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Status & Active Filter Pills Bar */}
        <div className="flex items-center justify-between flex-wrap gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Showing:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {viewMode === 'material' ? filteredMaterials.length : filteredTransactions.length} records
            </span>
            <span>• Period:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
              {period.replace('_', ' ')}
            </span>
            {categoryFilter !== 'ALL' && (
              <span className="px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold text-[10px]">
                Cat: {categoryFilter}
              </span>
            )}
            {codeFilter !== 'ALL' && (
              <span className="px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-bold text-[10px]">
                Code: {codeFilter}
              </span>
            )}
            {movementFilter === 'IN_PROGRESS' && (
              <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold text-[10px]">
                🟡 In-Progress WIP Floor
              </span>
            )}
            {movementFilter === 'FREE_AVAILABLE' && (
              <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-[10px]">
                🟢 Free Available Stock
              </span>
            )}
            {movementFilter === 'LAB_REJECTED' && (
              <span className="px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-bold text-[10px]">
                ❌ Lab Rejections Only
              </span>
            )}
          </div>

          <div className="text-[10px] text-slate-400">
            Auto-Refreshed: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      {viewMode === 'material' ? (
        /* MODE 1: MATERIAL-WISE SUMMARY TABLE WITH COLUMN SORTING */
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden">
          {/* Desktop Table View with Clickable Column Sorting */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <TableHead className="w-8 text-center"></TableHead>

                  {/* 1. Code Column Header */}
                  <TableHead className="min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('code')}
                      className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                      title="Sort by RM Code"
                    >
                      <span>Code</span>
                      {renderSortIndicator('code')}
                    </button>
                  </TableHead>

                  {/* 2. Raw Material Name Header */}
                  <TableHead className="min-w-[190px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('name')}
                      className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                      title="Sort by Raw Material Name"
                    >
                      <span>Raw Material Name</span>
                      {renderSortIndicator('name')}
                    </button>
                  </TableHead>

                  {/* 3. Category & UOM Header */}
                  <TableHead className="min-w-[120px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('category')}
                      className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                      title="Sort by Category"
                    >
                      <span>Category & UOM</span>
                      {renderSortIndicator('category')}
                    </button>
                  </TableHead>

                  {/* 4. Current Stock & WIP Header */}
                  <TableHead className="text-right min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('stock')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Current Stock"
                    >
                      <span>Current Stock & WIP</span>
                      {renderSortIndicator('stock')}
                    </button>
                  </TableHead>

                  {/* 5. Period IN Header */}
                  <TableHead className="text-right min-w-[115px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('in')}
                      className="group inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Period Inward"
                    >
                      <span>Period IN</span>
                      {renderSortIndicator('in')}
                    </button>
                  </TableHead>

                  {/* 6. Period OUT Header */}
                  <TableHead className="text-right min-w-[115px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('out')}
                      className="group inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-800 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Period Outward"
                    >
                      <span>Period OUT</span>
                      {renderSortIndicator('out')}
                    </button>
                  </TableHead>

                  {/* 7. Net Flow Header */}
                  <TableHead className="text-right min-w-[105px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('net')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Net Movement"
                    >
                      <span>Net Flow</span>
                      {renderSortIndicator('net')}
                    </button>
                  </TableHead>

                  {/* 8. Valuation Header */}
                  <TableHead className="text-right min-w-[115px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('valuation')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Valuation"
                    >
                      <span>Valuation</span>
                      {renderSortIndicator('valuation')}
                    </button>
                  </TableHead>

                  {/* 9. QC Status Header */}
                  <TableHead className="text-center min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('qc')}
                      className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none mx-auto"
                      title="Sort by QC Status / Rejections"
                    >
                      <span>QC Status</span>
                      {renderSortIndicator('qc')}
                    </button>
                  </TableHead>

                  {/* 10. Actions Header */}
                  <TableHead className="text-center min-w-[130px] font-semibold text-slate-700 dark:text-slate-200">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAnyLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={11} className="py-3">
                        <Skeleton className="h-5 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <Package className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-medium">No raw materials match the current filters.</p>
                        <p className="text-[11px] text-slate-500">Try adjusting your search keyword, category, or time period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMaterials.map((mat) => {
                    const isExpanded = expandedMaterialIds.has(mat.id);
                    const isLoadingHistory = expandedLoadingIds.has(mat.id);
                    const isLow = mat.status === 'LOW_STOCK';
                    const isOut = mat.status === 'OUT_OF_STOCK';
                    const hasWip = Number(mat.inProgressStock || 0) > 0;
                    const hasReject = mat.hasLabRejection || mat.labStatus === 'LAB_REJECTED';
                    const pyClass = isCompactDensity ? 'py-1.5' : 'py-2.5';

                    return (
                      <React.Fragment key={mat.id}>
                        {/* Main Item Row */}
                        <TableRow
                          className={`text-xs transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 ${
                            isExpanded ? 'bg-slate-50/90 dark:bg-slate-800/50' : ''
                          } ${hasReject ? 'border-l-4 border-l-rose-500' : hasWip ? 'border-l-4 border-l-amber-500' : ''}`}
                        >
                          {/* 0. Expand Button */}
                          <TableCell className={`text-center ${pyClass} px-1`}>
                            <button
                              onClick={() => toggleExpandRow(mat.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={isExpanded ? 'Collapse movements' : 'Expand date-wise in/out breakdown'}
                            >
                              {isLoadingHistory ? (
                                <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </TableCell>

                          {/* 1. Code */}
                          <TableCell className={`font-mono font-semibold ${pyClass}`}>
                            <button
                              onClick={() => handleOpenHistory(mat.id)}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline hover:text-emerald-800 text-left font-bold cursor-pointer"
                              title="Click to view full lifecycle audit drawer"
                            >
                              {mat.code || '—'}
                            </button>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {hasWip && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  WIP Run
                                </span>
                              )}
                              {hasReject && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-300 font-bold border border-rose-300">
                                  ❌ Reject
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 2. Raw Material Name */}
                          <TableCell className={pyClass}>
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={mat.name}>
                              {mat.name || '—'}
                            </div>
                            {mat.poReferenceNo && (
                              <button
                                onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer"
                                title="Redirect to Purchase Order"
                              >
                                <span>PO: {mat.poReferenceNo}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </TableCell>

                          {/* 3. Category & UOM */}
                          <TableCell className={pyClass}>
                            <div className="inline-block px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[120px]">
                              {mat.category || 'Uncategorised'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.2 font-mono">
                              Unit: {mat.uom || 'Unit'}
                            </div>
                          </TableCell>

                          {/* 4. Current Stock & WIP */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {Number(mat.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              <span className="text-[10px] text-slate-400 font-normal ml-0.5">{mat.uom}</span>
                            </div>
                            {hasWip ? (
                              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-sm bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300"
                                  title="Material committed to active batches on the floor"
                                >
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  WIP: {Number(mat.inProgressStock).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-sm bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 font-bold border border-emerald-300"
                                  title="Free available stock remaining for new production orders"
                                >
                                  Free: {Number(mat.availableStock !== undefined ? mat.availableStock : Math.max(0, (mat.currentStock || 0) - (mat.inProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                              </div>
                            ) : isOut ? (
                              <span className="text-[9px] px-1 py-0.2 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-semibold">
                                Out
                              </span>
                            ) : isLow ? (
                              <span className="text-[9px] px-1 py-0.2 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold">
                                Low
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">
                                In Hand
                              </span>
                            )}
                          </TableCell>

                          {/* 5. Period IN */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{Number(mat.periodInQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {mat.lastIn ? (
                              <button
                                onClick={() => {
                                  if (mat.lastIn.poId) handleRedirectToPO(mat.lastIn.poId, mat.lastIn.ref);
                                  else if (mat.lastIn.grnId) handleRedirectToGRN(mat.lastIn.grnId, mat.lastIn.ref);
                                }}
                                className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 hover:underline block text-right truncate max-w-[120px] ml-auto cursor-pointer"
                                title={`Last In: ${mat.lastIn.party} on ${formatDate(mat.lastIn.date)}`}
                              >
                                {mat.lastIn.ref}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </TableCell>

                          {/* 6. Period OUT */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-bold text-rose-600 dark:text-rose-400">
                              -{Number(mat.periodOutQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {mat.lastOut ? (
                              <div
                                className="text-[10px] text-rose-600/80 dark:text-rose-400/80 text-right truncate max-w-[120px] ml-auto"
                                title={`Last Out: ${mat.lastOut.party} on ${formatDate(mat.lastOut.date)}`}
                              >
                                {mat.lastOut.ref}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </TableCell>

                          {/* 7. Net Movement */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <span className={`inline-block px-1.5 py-0.2 rounded-sm font-semibold text-[11px] ${
                              Number(mat.netMovement || 0) > 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : Number(mat.netMovement || 0) < 0
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'text-slate-400'
                            }`}>
                              {Number(mat.netMovement || 0) > 0 ? '+' : ''}
                              {Number(mat.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </span>
                          </TableCell>

                          {/* 8. Valuation */}
                          <TableCell className={`text-right ${pyClass} font-mono`}>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              ₹{Number(mat.valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              @ ₹{Number(mat.ratePerUnit || 0).toFixed(2)}
                            </div>
                          </TableCell>

                          {/* 9. QC Status */}
                          <TableCell className={`text-center ${pyClass}`}>
                            {hasReject ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">
                                ❌ Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[10px]">
                                🟢 Passed
                              </span>
                            )}
                          </TableCell>

                          {/* 10. Actions */}
                          <TableCell className={`text-center ${pyClass}`}>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenHistory(mat.id)}
                                className="h-6 px-1.5 text-[10px] border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer"
                                title="Open full history drawer"
                              >
                                <Eye className="w-2.5 h-2.5 mr-0.5" />
                                <span>Audit</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenStockQuery(mat.id)}
                                className="h-6 px-1.5 text-[10px] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                title="Instant stock query"
                              >
                                <span>Query</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Inline Expandable Date-Wise Sub-Table */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                            <TableCell colSpan={11} className="p-2.5 sm:p-3">
                              <div className="space-y-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3 shadow-inner">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      Date-Wise Movements: {mat.name} ({mat.code})
                                    </span>
                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                      {mat.transactions?.length || 0} Movements
                                    </span>
                                    {hasWip && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Floor WIP: {mat.inProgressStock} {mat.uom}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {mat.poReferenceNo && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                                        className="h-6 text-[10px] border-blue-200 text-blue-600 cursor-pointer"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5 mr-1" />
                                        PO ({mat.poReferenceNo})
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenHistory(mat.id)}
                                      className="h-6 text-[10px] border-emerald-300 text-emerald-600 cursor-pointer"
                                    >
                                      Lifecycle Audit
                                    </Button>
                                  </div>
                                </div>

                                {isLoadingHistory ? (
                                  <div className="py-6 flex flex-col items-center justify-center space-y-1.5 text-slate-400 text-xs">
                                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                                    <span>Loading chronological date movements...</span>
                                  </div>
                                ) : mat.transactions && mat.transactions.length > 0 ? (
                                  <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-slate-100/60 dark:bg-slate-800/40 text-[10px]">
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                            Date & Time
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                                            Flow & Status
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[130px]">
                                            Transaction Type
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                            Document Ref
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[90px]">
                                            Batch / Lot
                                          </TableHead>
                                          <TableHead className="font-semibold text-emerald-700 dark:text-emerald-400 text-right min-w-[80px]">
                                            In (Qty)
                                          </TableHead>
                                          <TableHead className="font-semibold text-rose-700 dark:text-rose-400 text-right min-w-[80px]">
                                            Out (Qty)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right min-w-[85px]">
                                            Rate (₹)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right min-w-[85px]">
                                            Amount (₹)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center min-w-[90px]">
                                            QC Decision
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">
                                            Party / Destination
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[85px]">
                                            Handled By
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {mat.transactions.map((tx) => {
                                          const isIn = tx.flow === 'IN';
                                          const isInProgress = Boolean(
                                            tx.isInProgress ||
                                            tx.batchStatus === 'IN_PROGRESS' ||
                                            String(tx.typeLabel || '').includes('In Progress')
                                          );
                                          const isTxReject = Boolean(
                                            tx.isLabRejected ||
                                            String(tx.labStatus || '').includes('REJECT') ||
                                            Number(tx.rejectedQty || 0) > 0
                                          );

                                          return (
                                            <TableRow
                                              key={tx.id}
                                              className={`text-[11px] transition-colors border-b ${
                                                isTxReject
                                                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-l-4 border-l-rose-500'
                                                  : isInProgress
                                                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800/80'
                                              }`}
                                            >
                                              <TableCell className="font-mono py-1.5 text-slate-600 dark:text-slate-400">
                                                {formatDateTime(tx.date)}
                                              </TableCell>
                                              <TableCell className="py-1.5">
                                                {isTxReject ? (
                                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                                    ❌ REJECTED
                                                  </span>
                                                ) : isInProgress ? (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                                    🟡 WIP RUN
                                                  </span>
                                                ) : (
                                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                                    isIn
                                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                  }`}>
                                                    {isIn ? '🟢 IN' : '🔴 OUT'}
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-medium py-1.5">
                                                <div className="truncate max-w-[140px]" title={tx.typeLabel}>
                                                  {tx.typeLabel}
                                                </div>
                                              </TableCell>
                                              <TableCell className="font-mono py-1.5">
                                                {tx.poId ? (
                                                  <button
                                                    onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                                                    className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2 h-2" />
                                                  </button>
                                                ) : tx.grnId ? (
                                                  <button
                                                    onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                                                    className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2 h-2" />
                                                  </button>
                                                ) : tx.batchId || isInProgress ? (
                                                  <button
                                                    onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                                                    className={`hover:underline flex items-center gap-0.5 font-semibold cursor-pointer ${
                                                      isInProgress ? 'text-amber-700 font-bold' : 'text-purple-600'
                                                    }`}
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2 h-2" />
                                                  </button>
                                                ) : (
                                                  <span>{tx.referenceNo || '—'}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-mono text-slate-500 py-1.5">
                                                {tx.batchNumber || '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono font-bold py-1.5 text-emerald-600 dark:text-emerald-400">
                                                {isIn ? `+${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                                              </TableCell>
                                              <TableCell className={`text-right font-mono font-bold py-1.5 ${
                                                isInProgress ? 'text-amber-700' : 'text-rose-600'
                                              }`}>
                                                {!isIn ? `-${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono py-1.5 text-slate-700 dark:text-slate-300">
                                                {tx.rate ? `₹${Number(tx.rate).toFixed(2)}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono font-semibold py-1.5 text-slate-900 dark:text-white">
                                                {tx.amount ? `₹${Number(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                                              </TableCell>
                                              <TableCell className="text-center py-1.5">
                                                {isTxReject ? (
                                                  <span className="text-rose-700 font-bold text-[10px]">❌ Rejected</span>
                                                ) : (
                                                  <span className="text-emerald-700 font-medium text-[10px]">Passed</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={tx.partyName}>
                                                {tx.partyName || '—'}
                                              </TableCell>
                                              <TableCell className="py-1.5 text-slate-500 text-[10px]">
                                                {tx.user || '—'}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="py-4 text-center text-slate-400 text-xs">
                                    No transaction movements recorded for this material within the selected time period ({period}).
                                  </div>
                                )}
                              </div>
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

          {/* Mobile Responsive Cards View */}
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {isAnyLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-3 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-sm" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ))
            ) : paginatedMaterials.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">No raw materials match the current filters.</div>
            ) : (
              paginatedMaterials.map((mat) => {
                const isExpanded = expandedMaterialIds.has(mat.id);
                const isLoadingHistory = expandedLoadingIds.has(mat.id);
                const hasWip = Number(mat.inProgressStock || 0) > 0;
                const hasReject = mat.hasLabRejection || mat.labStatus === 'LAB_REJECTED';

                return (
                  <div
                    key={mat.id}
                    className={`p-3 space-y-2 bg-white dark:bg-slate-900 transition-colors ${
                      hasReject ? 'border-l-4 border-l-rose-500' : hasWip ? 'border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => handleOpenHistory(mat.id)}
                            className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {mat.code}
                          </button>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {mat.category}
                          </span>
                          {hasWip && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                              WIP
                            </span>
                          )}
                          {hasReject && (
                            <span className="text-[9px] px-1 py-0.2 rounded-full bg-rose-100 text-rose-900 font-bold border border-rose-300">
                              ❌ Reject
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {mat.name}
                        </h3>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {Number(mat.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} {mat.uom}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ₹{Number(mat.valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* Quick Metrics Grid */}
                    <div className="grid grid-cols-4 gap-1 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 block">In-Hand</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {Number(mat.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-amber-600 font-semibold block">WIP Floor</span>
                        <span className="font-mono font-bold text-amber-600">
                          {Number(mat.inProgressStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-600 font-semibold block">Free Stock</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {Number(mat.availableStock !== undefined ? mat.availableStock : Math.max(0, (mat.currentStock || 0) - (mat.inProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Net Flow</span>
                        <span className={`font-mono font-bold ${
                          Number(mat.netMovement || 0) > 0 ? 'text-emerald-600' : Number(mat.netMovement || 0) < 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {Number(mat.netMovement || 0) > 0 ? '+' : ''}{Number(mat.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Actions Bar */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <button
                        onClick={() => toggleExpandRow(mat.id)}
                        className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium cursor-pointer"
                      >
                        {isLoadingHistory ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        ) : isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        <span>{isExpanded ? 'Hide' : 'Movements'} ({mat.transactions?.length || 0})</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenHistory(mat.id)}
                          className="h-6 px-1.5 text-[10px] cursor-pointer"
                        >
                          Audit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenStockQuery(mat.id)}
                          className="h-6 px-1 text-[10px] cursor-pointer"
                        >
                          Query
                        </Button>
                      </div>
                    </div>

                    {/* Inline Expanded Movements for Mobile */}
                    {isExpanded && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5 animate-in fade-in duration-100">
                        {mat.transactions && mat.transactions.length > 0 ? (
                          mat.transactions.map((tx) => {
                            const isIn = tx.flow === 'IN';
                            const isInProgress = Boolean(tx.isInProgress || tx.batchStatus === 'IN_PROGRESS');
                            const isTxReject = Boolean(tx.isLabRejected || String(tx.labStatus || '').includes('REJECT'));

                            return (
                              <div
                                key={tx.id}
                                className={`p-1.5 rounded-md text-[11px] space-y-0.5 border ${
                                  isTxReject
                                    ? 'bg-rose-50/80 border-rose-300 border-l-4 border-l-rose-500'
                                    : isInProgress
                                    ? 'bg-amber-50/80 border-amber-300 border-l-4 border-l-amber-500'
                                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between font-mono text-[10px]">
                                  <span className="text-slate-500">{formatDate(tx.date)}</span>
                                  {isTxReject ? (
                                    <span className="px-1 py-0.2 rounded-sm font-bold bg-rose-100 text-rose-900">
                                      ❌ REJECT
                                    </span>
                                  ) : isInProgress ? (
                                    <span className="px-1 py-0.2 rounded-sm font-bold bg-amber-100 text-amber-900">
                                      🟡 -{tx.quantity} WIP
                                    </span>
                                  ) : (
                                    <span className={`px-1 py-0.2 rounded-sm font-bold ${
                                      isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {isIn ? `+${tx.quantity} IN` : `-${tx.quantity} OUT`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tx.typeLabel}</span>
                                  <span className="font-mono text-slate-500 text-[10px]">{tx.referenceNo}</span>
                                </div>
                                <div className="text-slate-500 truncate text-[10px]">
                                  {tx.partyName || tx.user}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-2 text-center text-[10px] text-slate-400">No movements recorded.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls with Page Size Dropdown (Just like rm/stock) */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-[11px]">Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex-1 w-full sm:w-auto">
              <Pagination
                currentPage={currentPage}
                totalPages={totalMaterialPages}
                totalRecords={filteredMaterials.length}
                pageSize={itemsPerPage}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          </div>
        </Card>
      ) : (
        /* MODE 2: DATE-WISE LEDGER & MOVEMENT MATRIX (WITH MATRIX & STREAM SUB-MODES) */
        <div className="space-y-2.5">
          {/* Sub-Mode Segmented Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-2xs">
            <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setLedgerSubMode('matrix')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  ledgerSubMode === 'matrix'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span>Date-Wise Movement Matrix</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  ledgerSubMode === 'matrix' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {matrixDates.length} Dates
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLedgerSubMode('stream')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  ledgerSubMode === 'stream'
                    ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Detailed Transaction Stream</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  ledgerSubMode === 'stream' ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {filteredTransactions.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                🟢 IN = Green
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                🔴 OUT = Red
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMatrixOnly}
                className="h-7 px-2.5 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-1 cursor-pointer font-semibold shadow-2xs"
                title="Quick download of the Date-Wise Movement Matrix as Excel"
              >
                <Download className="w-3 h-3 text-emerald-600" />
                <span>Export Matrix (Excel)</span>
              </Button>
            </div>
          </div>

          {ledgerSubMode === 'matrix' ? (
            /* SUB-MODE A: DATE-WISE MOVEMENT MATRIX (EXACT EXCEL FORMAT) */
            <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden">
              {/* Desktop & Tablet Table with Sticky Header & Sticky Left Columns */}
              <div className="hidden md:block overflow-x-auto max-h-[70vh] relative border-b border-slate-200 dark:border-slate-800">
                <Table className="border-collapse">
                  <TableHeader className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-xs shadow-2xs">
                    <TableRow className="border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      {/* Sticky RM Code */}
                      <TableHead className="sticky left-0 z-40 bg-slate-100 dark:bg-slate-850 min-w-[105px] font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 shadow-xs">
                        RM Code
                      </TableHead>
                      {/* Sticky Raw Material Name */}
                      <TableHead className="sticky left-[105px] z-40 bg-slate-100 dark:bg-slate-850 min-w-[180px] font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 shadow-xs">
                        Raw Material Name
                      </TableHead>
                      <TableHead className="min-w-[140px] font-semibold text-slate-700 dark:text-slate-300">
                        Category
                      </TableHead>
                      <TableHead className="min-w-[70px] font-semibold text-slate-700 dark:text-slate-300">
                        UOM
                      </TableHead>
                      <TableHead className="text-right min-w-[95px] font-bold text-slate-900 dark:text-white">
                        TotalStock
                      </TableHead>
                      <TableHead className="text-right min-w-[110px] font-bold text-emerald-700 dark:text-emerald-400">
                        Available Stock
                      </TableHead>
                      <TableHead className="text-right min-w-[125px] font-bold text-emerald-600 dark:text-emerald-400">
                        Period Inward IN ({period})
                      </TableHead>
                      <TableHead className="text-right min-w-[125px] font-bold text-rose-600 dark:text-rose-400">
                        Period Outward OUT ({period})
                      </TableHead>
                      <TableHead className="text-right min-w-[115px] font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700">
                        Total Valuation (₹)
                      </TableHead>

                      {/* Dynamic Chronological Date Headers (DD-MM-YYYY) */}
                      {matrixDates.length === 0 ? (
                        <TableHead className="min-w-[180px] text-center text-slate-400">
                          No Movement Dates Found
                        </TableHead>
                      ) : (
                        matrixDates.map((dateStr) => (
                          <TableHead
                            key={dateStr}
                            className="min-w-[105px] max-w-[130px] text-center font-bold font-mono text-slate-800 dark:text-slate-200 border-r border-slate-200/80 dark:border-slate-750 px-2 py-2"
                          >
                            <div className="text-[11px] font-bold">{dateStr}</div>
                          </TableHead>
                        ))
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isAnyLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell colSpan={9 + Math.max(1, matrixDates.length)} className="py-4">
                            <Skeleton className="h-6 w-full rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paginatedMaterials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9 + Math.max(1, matrixDates.length)} className="py-12 text-center text-slate-400">
                          No raw materials match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedMaterials.map((mat) => {
                        const cur = Number(mat.currentStock || 0);
                        const wip = Number(mat.inProgressStock || 0);
                        const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);
                        const val = Number(mat.valuation || 0);

                        return (
                          <TableRow
                            key={mat.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-xs transition-colors group"
                          >
                            {/* Sticky RM Code */}
                            <TableCell className="sticky left-0 z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 font-mono font-bold py-2 shadow-xs">
                              <button
                                onClick={() => handleOpenHistory(mat.id)}
                                className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                title="Click to view material audit timeline"
                              >
                                {mat.code}
                              </button>
                            </TableCell>

                            {/* Sticky Raw Material Name */}
                            <TableCell className="sticky left-[105px] z-20 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 border-r border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white py-2 shadow-xs truncate max-w-[200px]" title={mat.name}>
                              {mat.name}
                            </TableCell>

                            <TableCell className="text-slate-600 dark:text-slate-300 py-2 truncate max-w-[140px]" title={mat.category}>
                              {mat.category}
                            </TableCell>

                            <TableCell className="font-mono text-slate-500 py-2">
                              {formatUOM(mat.uom)}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-white py-2">
                              {cur.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 py-2">
                              {free.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 py-2">
                              {Number(mat.periodInQty || 0) > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {Number(mat.periodInQty).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                              ) : '0'}
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400 py-2">
                              {Number(mat.periodOutQty || 0) > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  {Number(mat.periodOutQty).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                </span>
                              ) : '0'}
                            </TableCell>

                            <TableCell className="text-right font-mono font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700 py-2">
                              ₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </TableCell>

                            {/* Dynamic Date Columns matching Image 1 */}
                            {matrixDates.length === 0 ? (
                              <TableCell className="text-center text-slate-400 py-2">
                                —
                              </TableCell>
                            ) : (
                              matrixDates.map((dateStr) => {
                                const cell = matrixData[mat.id]?.[dateStr] || { inQty: 0, outQty: 0, transactions: [] };
                                const hasIn = cell.inQty > 0;
                                const hasOut = cell.outQty > 0;

                                // PO Supplier Invoice Date check
                                const poTx = cell.transactions.find(t => t.supplierInvoiceDate || t.supplierInvoiceNo);
                                const invDateFormatted = poTx?.supplierInvoiceDate ? formatDate(poTx.supplierInvoiceDate) : null;

                                return (
                                  <TableCell
                                    key={dateStr}
                                    className="text-center font-mono py-1.5 px-1.5 border-r border-slate-100 dark:border-slate-800/80 align-middle"
                                    title={
                                      cell.transactions.length > 0
                                        ? `${dateStr} Movements:\n${cell.transactions.map(t => `• ${t.flow}: ${t.quantity} ${mat.uom} (${t.typeLabel} - ${t.referenceNo})${t.supplierInvoiceDate ? ` | Supplier Inv Date: ${formatDate(t.supplierInvoiceDate)}` : ''}`).join('\n')}`
                                        : 'No movement'
                                    }
                                  >
                                    {hasIn && hasOut ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="w-full text-center px-1.5 py-0.5 rounded-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-[11px] leading-tight border border-emerald-200 dark:border-emerald-800/60">
                                          +{cell.inQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                        </span>
                                        <span className="w-full text-center px-1.5 py-0.5 rounded-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 text-[11px] leading-tight border border-rose-200 dark:border-rose-800/60">
                                          -{cell.outQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                        </span>
                                      </div>
                                    ) : hasIn ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="px-2 py-0.5 rounded-md font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                          {cell.inQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                        </span>
                                        {invDateFormatted && (
                                          <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 font-sans leading-none font-semibold" title={`Supplier Invoice Date: ${invDateFormatted}`}>
                                            Inv: {invDateFormatted}
                                          </span>
                                        )}
                                      </div>
                                    ) : hasOut ? (
                                      <span className="px-2 py-0.5 rounded-md font-bold text-rose-600 dark:text-rose-400 text-xs">
                                        {cell.outQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700 select-none">—</span>
                                    )}
                                  </TableCell>
                                );
                              })
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card Responsive View for Matrix */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {isAnyLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="p-3 space-y-2">
                      <Skeleton className="h-4 w-1/3 rounded-sm" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  ))
                ) : paginatedMaterials.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">No materials found.</div>
                ) : (
                  paginatedMaterials.map((mat) => {
                    const cur = Number(mat.currentStock || 0);
                    const wip = Number(mat.inProgressStock || 0);
                    const free = mat.availableStock !== undefined ? Number(mat.availableStock) : Math.max(0, cur - wip);

                    // Collect dates with movement for this material
                    const activeDates = matrixDates.filter(dStr => {
                      const c = matrixData[mat.id]?.[dStr];
                      return c && (c.inQty > 0 || c.outQty > 0);
                    });

                    return (
                      <div key={mat.id} className="p-3 space-y-2 bg-white dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <button
                              onClick={() => handleOpenHistory(mat.id)}
                              className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              {mat.code}
                            </button>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">{mat.name}</h3>
                            <span className="text-[10px] text-slate-500">{mat.category} • {formatUOM(mat.uom)}</span>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {cur.toLocaleString('en-IN', { maximumFractionDigits: 1 })} {formatUOM(mat.uom)}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-semibold">
                              Free: {free.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                            </div>
                          </div>
                        </div>

                        {/* Date Movements Badges */}
                        <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Date-Wise Movements ({activeDates.length}):
                          </span>
                          {activeDates.length === 0 ? (
                            <span className="text-[11px] text-slate-400 italic">No movement in period</span>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                              {activeDates.map(dStr => {
                                const c = matrixData[mat.id]?.[dStr] || { inQty: 0, outQty: 0 };
                                const poTx = c.transactions?.find(t => t.supplierInvoiceDate);
                                return (
                                  <div key={dStr} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center font-mono">
                                    <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{dStr}</div>
                                    <div className="flex items-center justify-center gap-1.5 mt-0.5 text-xs">
                                      {c.inQty > 0 && (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                          +{c.inQty}
                                        </span>
                                      )}
                                      {c.outQty > 0 && (
                                        <span className="font-bold text-rose-600 dark:text-rose-400">
                                          -{c.outQty}
                                        </span>
                                      )}
                                    </div>
                                    {poTx?.supplierInvoiceDate && (
                                      <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                                        Inv: {formatDate(poTx.supplierInvoiceDate)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls with Page Size Dropdown for Matrix */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-[11px]">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex-1 w-full sm:w-auto">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalMaterialPages}
                    totalRecords={filteredMaterials.length}
                    pageSize={itemsPerPage}
                    onPageChange={(page) => setCurrentPage(page)}
                  />
                </div>
              </div>
            </Card>
          ) : (
            /* SUB-MODE B: CHRONOLOGICAL DETAILED TRANSACTION STREAM */
            <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                      {/* Date & Time Header */}
                      <TableHead className="min-w-[110px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('date')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Date & Time</span>
                          {renderSortIndicator('date')}
                        </button>
                      </TableHead>

                      {/* Flow & Status Header */}
                      <TableHead className="text-center min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('flow')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none mx-auto"
                        >
                          <span>Flow & Status</span>
                          {renderSortIndicator('flow')}
                        </button>
                      </TableHead>

                      {/* Transaction Type Header */}
                      <TableHead className="min-w-[140px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('type')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Transaction Type</span>
                          {renderSortIndicator('type')}
                        </button>
                      </TableHead>

                      {/* RM Code Header */}
                      <TableHead className="min-w-[90px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('code')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>RM Code</span>
                          {renderSortIndicator('code')}
                        </button>
                      </TableHead>

                      {/* Raw Material Name Header */}
                      <TableHead className="min-w-[170px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('name')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Raw Material Name</span>
                          {renderSortIndicator('name')}
                        </button>
                      </TableHead>

                      {/* Document Ref Header */}
                      <TableHead className="min-w-[115px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('ref')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Document Ref</span>
                          {renderSortIndicator('ref')}
                        </button>
                      </TableHead>

                      {/* Supplier Invoice Date Header */}
                      <TableHead className="min-w-[125px] font-semibold text-slate-700 dark:text-slate-200">
                        Supplier Inv Date
                      </TableHead>

                      {/* Batch / Lot Header */}
                      <TableHead className="min-w-[90px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('batch')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Batch / Lot</span>
                          {renderSortIndicator('batch')}
                        </button>
                      </TableHead>

                      {/* Inward (IN) Header */}
                      <TableHead className="text-right min-w-[85px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('in')}
                          className="group inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Inward (IN)</span>
                          {renderSortIndicator('in')}
                        </button>
                      </TableHead>

                      {/* Outward (OUT) Header */}
                      <TableHead className="text-right min-w-[85px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('out')}
                          className="group inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-800 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Outward (OUT)</span>
                          {renderSortIndicator('out')}
                        </button>
                      </TableHead>

                      {/* Rate Header */}
                      <TableHead className="text-right min-w-[85px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('rate')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Rate (₹)</span>
                          {renderSortIndicator('rate')}
                        </button>
                      </TableHead>

                      {/* Amount Header */}
                      <TableHead className="text-right min-w-[85px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('amount')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none ml-auto"
                        >
                          <span>Amount (₹)</span>
                          {renderSortIndicator('amount')}
                        </button>
                      </TableHead>

                      {/* QC Status Header */}
                      <TableHead className="text-center min-w-[95px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('qc')}
                          className="group inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none mx-auto"
                        >
                          <span>QC Status</span>
                          {renderSortIndicator('qc')}
                        </button>
                      </TableHead>

                      {/* Party / Notes Header */}
                      <TableHead className="min-w-[150px]">
                        <button
                          type="button"
                          onClick={() => handleColumnSort('party')}
                          className="group flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition-colors cursor-pointer select-none"
                        >
                          <span>Party / Notes</span>
                          {renderSortIndicator('party')}
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isAnyLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell colSpan={14} className="py-3">
                            <Skeleton className="h-5 w-full rounded-md" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paginatedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-10 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-1.5">
                            <Calendar className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                            <p className="text-xs font-medium">No transactions recorded for this period.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTransactions.map((tx) => {
                        const isIn = tx.flow === 'IN';
                        const isInProgress = Boolean(tx.isInProgress || tx.batchStatus === 'IN_PROGRESS');
                        const isTxReject = Boolean(tx.isLabRejected || String(tx.labStatus || '').includes('REJECT'));
                        const pyClass = isCompactDensity ? 'py-1.5' : 'py-2.5';
                        const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : '—';

                        return (
                          <TableRow
                            key={tx.id}
                            className={`text-xs border-b transition-colors ${
                              isTxReject
                                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-l-4 border-l-rose-500'
                                : isInProgress
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                            }`}
                          >
                            <TableCell className={`font-mono text-slate-600 dark:text-slate-400 ${pyClass}`}>
                              {formatDateTime(tx.date)}
                            </TableCell>
                            <TableCell className={`text-center ${pyClass}`}>
                              {isTxReject ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                  ❌ REJECTED
                                </span>
                              ) : isInProgress ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  🟡 IN PROGRESS
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                  isIn
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {isIn ? '🟢 IN' : '🔴 OUT'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className={`font-medium ${pyClass}`}>
                              <div className="truncate max-w-[140px]" title={tx.typeLabel}>
                                {tx.typeLabel}
                              </div>
                            </TableCell>
                            <TableCell className={`font-mono font-semibold ${pyClass}`}>
                              <button
                                onClick={() => handleOpenHistory(tx.rawMaterialId)}
                                className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
                              >
                                {tx.rawMaterialCode}
                              </button>
                            </TableCell>
                            <TableCell className={pyClass}>
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[170px]" title={tx.rawMaterialName}>
                                {tx.rawMaterialName}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {tx.category} • {tx.uom}
                              </div>
                            </TableCell>
                            <TableCell className={`font-mono ${pyClass}`}>
                              {tx.poId ? (
                                <button
                                  onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                                  className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                >
                                  <span>{tx.referenceNo}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : tx.grnId ? (
                                <button
                                  onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                                  className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                >
                                  <span>{tx.referenceNo}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : tx.batchId || isInProgress ? (
                                <button
                                  onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                                  className={`hover:underline flex items-center gap-0.5 font-semibold cursor-pointer ${
                                    isInProgress ? 'text-amber-700 font-bold' : 'text-purple-600'
                                  }`}
                                >
                                  <span>{tx.referenceNo}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-300">{tx.referenceNo || '—'}</span>
                              )}
                            </TableCell>

                            {/* Supplier Invoice Date */}
                            <TableCell className={`font-mono text-xs ${pyClass} ${invDate !== '—' ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
                              {invDate}
                            </TableCell>

                            <TableCell className={`font-mono text-slate-500 ${pyClass}`}>
                              {tx.batchNumber || '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 ${pyClass}`}>
                              {isIn ? `+${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${isInProgress ? 'text-amber-700' : 'text-rose-600'} ${pyClass}`}>
                              {!isIn ? `-${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 1 })}` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-slate-700 dark:text-slate-300 ${pyClass}`}>
                              {tx.rate ? `₹${Number(tx.rate).toFixed(2)}` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-semibold text-slate-900 dark:text-white ${pyClass}`}>
                              {tx.amount ? `₹${Number(tx.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                            <TableCell className={`text-center ${pyClass}`}>
                              {isTxReject ? (
                                <span className="text-rose-700 font-bold text-[10px]">❌ Rejected</span>
                              ) : (
                                <span className="text-emerald-700 font-medium text-[10px]">Passed</span>
                              )}
                            </TableCell>
                            <TableCell className={`${pyClass} text-slate-700 dark:text-slate-300 truncate max-w-[150px]`} title={tx.compositeComment || tx.partyName}>
                              {tx.partyName || tx.user || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Ledger Cards View */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                {isAnyLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="p-3 space-y-1.5">
                      <Skeleton className="h-4 w-1/3 rounded-sm" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  ))
                ) : paginatedTransactions.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">No movements recorded.</div>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isIn = tx.flow === 'IN';
                    const isInProgress = Boolean(tx.isInProgress || tx.batchStatus === 'IN_PROGRESS');
                    const isTxReject = Boolean(tx.isLabRejected || String(tx.labStatus || '').includes('REJECT'));
                    const invDate = tx.supplierInvoiceDate ? formatDate(tx.supplierInvoiceDate) : null;

                    return (
                      <div
                        key={tx.id}
                        className={`p-3 space-y-1.5 bg-white dark:bg-slate-900 transition-colors ${
                          isTxReject
                            ? 'border-l-4 border-l-rose-500 bg-rose-50/40'
                            : isInProgress
                            ? 'border-l-4 border-l-amber-500 bg-amber-50/40'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-500">{formatDateTime(tx.date)}</span>
                          {isTxReject ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900">
                              ❌ REJECTED
                            </span>
                          ) : isInProgress ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                              🟡 -{tx.quantity} WIP
                            </span>
                          ) : (
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                              isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isIn ? `+${tx.quantity} IN` : `-${tx.quantity} OUT`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {tx.rawMaterialName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {tx.rawMaterialCode} • {tx.category} • {tx.uom}
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                              {tx.typeLabel}
                            </span>
                          </div>
                        </div>

                        {invDate && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                            Supplier Inv Date: {invDate}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="font-mono text-slate-600 dark:text-slate-400">
                            Ref: {tx.referenceNo} {tx.batchNumber ? `(${tx.batchNumber})` : ''}
                          </div>
                          <div className="text-slate-500 text-[10px] truncate max-w-[140px]">
                            {tx.partyName || tx.user}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls with Page Size Dropdown for Stream */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-[11px]">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex-1 w-full sm:w-auto">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalTransactionPages}
                    totalRecords={filteredTransactions.length}
                    pageSize={itemsPerPage}
                    onPageChange={(page) => setCurrentPage(page)}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── EXPORT OPTIONS MODAL (2 Dedicated Types + Master Multi-Sheet Option) ── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Export Raw Material In-Out Reports
                </h2>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select your export format. Both options include batch numbers, PO numbers, rates, valuations, lab inspection results, and full audit comments.
            </p>

            <div className="space-y-3">
              {/* Option 1: Date-Wise Stock In-Out Matrix (Matches User's Excel Format) */}
              <div
                onClick={handleExportMatrixOnly}
                className="group p-3.5 rounded-xl border border-emerald-400 dark:border-emerald-700 hover:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100/50 transition-all cursor-pointer flex items-start gap-3 shadow-xs"
              >
                <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <TableProperties className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 group-hover:text-emerald-700">
                      1. Date-Wise Stock In-Out Matrix Report (Excel Layout)
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Matches Excel Grid
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-400/90">
                    Full date-by-date matrix grid: RM Code, Material Name, Category, UOM, TotalStock, Available Stock, Period Inward IN, Period Outward OUT, Total Valuation (₹), followed by dynamic chronological date columns ({matrixDates.length} Dates) with Green IN & Red OUT, plus Sheet 2 PO Supplier Invoice Date audit (e.g. 15 Oct 2026).
                  </p>
                </div>
              </div>

              {/* Option 2: Master Summary */}
              <div
                onClick={handleExportSummaryOnly}
                className="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Package className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700">
                      2. Raw Material Master Summary Report
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {filteredMaterials.length} Items
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    All raw materials with Total Current Stock, In-Progress WIP, Free Available Stock, Period In/Out, Net Flow, Standard Rates, Valuations, Latest PO, Latest Batch, and Lab/QC Decision Comments.
                  </p>
                </div>
              </div>

              {/* Option 3: Date-Wise Ledger */}
              <div
                onClick={handleExportLedgerOnly}
                className="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700">
                      3. Chronological Date-Wise In-Out Ledger (with Supplier Invoice Date)
                    </h3>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {filteredTransactions.length} Transactions
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Complete chronological movement log with exact Date & Time, Flow (IN/OUT), PO Supplier Invoice Date (15 Oct 2026), Invoice No, Document Ref, PO Ref, Batch No, In Qty, Out Qty, Unit Rates, Amount, and QC decisions.
                  </p>
                </div>
              </div>

              {/* Option 4: All-in-One Master Workbook */}
              <div
                onClick={handleExportCompleteWorkbook}
                className="group p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100/50 transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      4. Complete Multi-Sheet Enterprise Master Workbook (All-in-One)
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                      6 Sheets
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Comprehensive multi-sheet workbook containing: Sheet 1 (Date-Wise Matrix), Sheet 2 (Summary), Sheet 3 (Chronological Ledger), Sheet 4 (PO Supplier Invoice Date Audit), Sheet 5 (Floor WIP), and Sheet 6 (QC Audits).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportModalOpen(false)}
                className="text-xs h-8 cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMBEDDED RM HISTORY DRAWER ── */}
      {selectedMaterialId && (
        <RMHistoryDrawer
          materialId={selectedMaterialId}
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setSelectedMaterialId(null);
          }}
          initialTab={historyInitialTab}
        />
      )}

      {/* ── EMBEDDED RM STOCK QUERY MODAL ── */}
      {selectedStockQueryId && (
        <RMStockQueryModal
          materialId={selectedStockQueryId}
          isOpen={isStockQueryOpen}
          onClose={() => {
            setIsStockQueryOpen(false);
            setSelectedStockQueryId(null);
          }}
          onOpenHistory={(matId, tab) => {
            setIsStockQueryOpen(false);
            setSelectedMaterialId(matId);
            setHistoryInitialTab(tab || 'timeline');
            setIsHistoryOpen(true);
          }}
        />
      )}
    </div>
  );
}

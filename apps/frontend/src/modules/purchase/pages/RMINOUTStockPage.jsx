import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  Package,
  Search,
  AlertTriangle,
  RefreshCw,
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
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import RMHistoryDrawer from '@/modules/purchase/components/RMHistoryDrawer';
import RMStockQueryModal from '@/modules/purchase/components/RMStockQueryModal';

export default function RMINOUTStockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // URL query params
  const initialPeriod = searchParams.get('period') || 'this_month';
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || 'ALL';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';

  // Time Period State
  const [period, setPeriod] = useState(initialPeriod); // today | yesterday | this_week | last_week | this_month | last_month | all | custom
  const [customStartDate, setCustomStartDate] = useState(initialStartDate);
  const [customEndDate, setCustomEndDate] = useState(initialEndDate);
  const [appliedCustomStart, setAppliedCustomStart] = useState(initialStartDate);
  const [appliedCustomEnd, setAppliedCustomEnd] = useState(initialEndDate);

  // View Mode: 'material' (Grouped by Material) | 'ledger' (Chronological Stream of all In/Out)
  const [viewMode, setViewMode] = useState('material');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [movementFilter, setMovementFilter] = useState('ALL'); // ALL | IN_PROGRESS | WITH_MOVEMENT | IN_ONLY | OUT_ONLY | NET_POSITIVE | NET_NEGATIVE | LOW_STOCK | OUT_OF_STOCK
  const [sortBy, setSortBy] = useState('code_asc');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Pagination State
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

  // 1. Primary Query: Fetch Base RM Stock (Identical API to /rm/stock - guaranteed to work on running backend)
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
    staleTime: 15000,
  });

  // 2. Secondary Query: Try dedicated /rm-stock/in-out endpoint
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
        // Fallback silently if backend hasn't restarted yet
        return null;
      }
    },
    refetchOnMount: 'always',
    staleTime: 30000,
  });

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

      // Flatten transactions
      const txList = [];

      // GRN receipts (IN)
      (hData.grnReceipts || []).forEach(g => {
        txList.push({
          id: `grn-${g.id}`,
          date: g.receivedDate,
          flow: 'IN',
          type: 'GRN',
          typeLabel: 'GRN Inward Receipt',
          quantity: Number(g.actualReceivedQty || 0),
          referenceNo: g.referenceNo || 'GRN',
          poReferenceNo: g.poReferenceNo,
          poId: g.poId,
          grnId: g.grnId || g.id,
          batchNumber: g.batch?.batchNumber || '—',
          partyName: g.supplierName || 'Vendor Receipt',
          user: g.receivedByName || 'Gate Officer',
          notes: g.discrepancyNotes || `Challan: ${g.challanNumber || 'N/A'}`
        });
      });

      // Stock Adjustments (ADDITION = IN, SUBTRACTION = OUT)
      (hData.stockAdjustments || []).forEach(a => {
        const isAdd = a.type === 'ADDITION';
        txList.push({
          id: `adj-${a.id}`,
          date: a.createdAt,
          flow: isAdd ? 'IN' : 'OUT',
          type: isAdd ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUB',
          typeLabel: isAdd ? 'Stock Adjustment (+)' : 'Stock Adjustment (-)',
          quantity: Number(a.quantity || 0),
          referenceNo: `ADJ-${a.id.slice(-6).toUpperCase()}`,
          batchNumber: 'Manual Correction',
          partyName: `Adjustment: ${a.notes || a.type}`,
          user: a.userName || 'Supervisor',
          notes: a.notes || 'Stock Reconciliation'
        });
      });

      // Production Usages (OUT) - Highlight In-Progress batches
      (hData.productionUsages || []).forEach(u => {
        if (u.isCancelled) return;
        const bStatus = String(u.batchStatus || '').toLowerCase();
        const isInProgress = bStatus.includes('progress') || bStatus.includes('running') || bStatus.includes('paused') || bStatus.includes('draft');
        txList.push({
          id: `usage-${u.id}`,
          date: u.date,
          flow: 'OUT',
          type: 'PROD_USAGE',
          typeLabel: isInProgress ? 'Production Issue (In Progress WIP)' : 'Production Consumption',
          quantity: Number(u.actualUsedQty || u.requiredQty || 0),
          referenceNo: u.batchNumber || 'Prod Batch',
          batchId: u.batchId,
          batchStatus: isInProgress ? 'IN_PROGRESS' : 'COMPLETED',
          isInProgress,
          rawBatchStatus: u.batchStatus,
          batchNumber: u.batchNoTakenFrom || 'RM Lot',
          partyName: `Product: ${u.productName}`,
          user: 'Production Team',
          notes: `Status: ${u.batchStatus || 'Completed'}`
        });
      });

      // Resale / Dispatches (OUT)
      (hData.resales || []).forEach(r => {
        txList.push({
          id: `resale-${r.id}`,
          date: r.orderDate,
          flow: 'OUT',
          type: 'RESALE',
          typeLabel: 'Direct Resale / Dispatch',
          quantity: Number(r.quantity || 0),
          referenceNo: r.docNo || r.referenceNo || 'SO',
          orderId: r.orderId,
          batchNumber: r.batchNo || 'Direct Stock',
          partyName: `Customer: ${r.customerName}`,
          user: 'Sales Team',
          notes: `${r.docType}: ${r.status}`
        });
      });

      // RM Wastage (OUT)
      (hData.wasteRecords || []).forEach(w => {
        txList.push({
          id: `waste-${w.id}`,
          date: w.date,
          flow: 'OUT',
          type: 'WASTE',
          typeLabel: 'RM Scrap / Wastage',
          quantity: Number(w.quantity || 0),
          referenceNo: w.referenceNo || 'WASTE',
          batchNumber: w.batchNumber || '—',
          partyName: `Wastage: ${w.remarks || w.notes || 'Scrap'}`,
          user: w.responsiblePerson || 'Store Staff',
          notes: w.remarks || w.notes
        });
      });

      // Purchase Returns (OUT)
      (hData.purchaseReturns || []).forEach(ret => {
        txList.push({
          id: `ret-${ret.id}`,
          date: ret.returnDate,
          flow: 'OUT',
          type: 'RETURN',
          typeLabel: 'Purchase Return to Vendor',
          quantity: Number(ret.returnQty || 0),
          referenceNo: ret.referenceNo || 'RETURN',
          poReferenceNo: ret.poReferenceNo,
          poId: ret.poId,
          grnId: ret.grnId,
          batchNumber: 'Vendor Return',
          partyName: `Return: ${ret.supplierName}`,
          user: ret.createdByName || 'Staff',
          notes: ret.returnReason
        });
      });

      txList.sort((a, b) => new Date(b.date) - new Date(a.date));

      const updatedCache = {
        ...materialHistoryCache,
        [matId]: {
          hData,
          txList
        }
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

  // Merge Base Stock with Dedicated Data (or Cache)
  const unifiedMaterials = useMemo(() => {
    // If dedicated API returned rich results, map them directly
    if (dedicatedData?.materials && dedicatedData.materials.length > 0) {
      return dedicatedData.materials;
    }

    // Otherwise, build from baseStock and materialHistoryCache
    return baseStock.map(item => {
      const curStock = Number(item.availableQuantity ?? item.currentStock ?? item.stock ?? 0);
      const alert = Number(item.alertLevel || 0);
      const rate = Number(item.rateWithTax || item.ratePerUnit || item.masterStandardRate || 0);
      const val = Number(item.valueWithTax || item.value || (curStock * rate) || 0);

      // Check if we have loaded transactions for this item
      const cached = materialHistoryCache[item.id];
      let periodIn = 0;
      let periodOut = 0;
      let inProgressStock = 0;
      let lastIn = null;
      let lastOut = null;
      let txs = [];

      if (cached?.txList) {
        cached.txList.forEach(tx => {
          const inRange = isDateInPeriod(tx.date);
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

  // Overall Summary Metrics (with WIP and Available stock breakdown)
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
      netMovement: Math.round((totIn - totOut) * 100) / 100,
      totalValuation: Math.round(totVal * 100) / 100,
      activeMovementCount: activeCount
    };
  }, [dedicatedData, unifiedMaterials]);

  // Distinct Categories
  const categoryOptions = useMemo(() => {
    const set = new Set();
    unifiedMaterials.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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
    setSearchParams(params, { replace: true });
  }, [period, appliedCustomStart, appliedCustomEnd, searchTerm, categoryFilter, setSearchParams]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, movementFilter, sortBy, period, appliedCustomStart, appliedCustomEnd, viewMode]);

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

  // Filtered & Sorted Materials
  const filteredMaterials = useMemo(() => {
    let result = unifiedMaterials.filter(item => {
      // 1. Search filter
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
            (t.partyName || '').toLowerCase().includes(term)
          )
        );
        if (!matchesTerm) return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'ALL') {
        if ((item.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. Movement / Stock filter
      if (movementFilter === 'IN_PROGRESS') {
        if (Number(item.inProgressStock || 0) <= 0) return false;
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

    result.sort((a, b) => {
      if (sortBy === 'code_asc') {
        return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'code_desc') {
        return (b.code || '').localeCompare(a.code || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'category_asc') {
        return (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'stock_desc') {
        return Number(b.currentStock || 0) - Number(a.currentStock || 0);
      }
      if (sortBy === 'stock_asc') {
        return Number(a.currentStock || 0) - Number(b.currentStock || 0);
      }
      if (sortBy === 'wip_desc') {
        return Number(b.inProgressStock || 0) - Number(a.inProgressStock || 0);
      }
      if (sortBy === 'in_desc') {
        return Number(b.periodInQty || 0) - Number(a.periodInQty || 0);
      }
      if (sortBy === 'out_desc') {
        return Number(b.periodOutQty || 0) - Number(a.periodOutQty || 0);
      }
      if (sortBy === 'net_desc') {
        return Number(b.netMovement || 0) - Number(a.netMovement || 0);
      }
      if (sortBy === 'net_asc') {
        return Number(a.netMovement || 0) - Number(b.netMovement || 0);
      }
      if (sortBy === 'valuation_desc') {
        return Number(b.valuation || 0) - Number(a.valuation || 0);
      }
      return 0;
    });

    return result;
  }, [unifiedMaterials, searchTerm, categoryFilter, movementFilter, sortBy]);

  // Filtered Date-Wise Ledger Transactions
  const filteredTransactions = useMemo(() => {
    let result = unifiedAllTransactions.filter(tx => {
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
          (tx.notes || '').toLowerCase().includes(term)
        );
        if (!matchesTerm) return false;
      }

      if (categoryFilter !== 'ALL') {
        if ((tx.category || 'Uncategorised') !== categoryFilter) return false;
      }

      if (movementFilter === 'IN_PROGRESS') {
        if (!tx.isInProgress && tx.batchStatus !== 'IN_PROGRESS') return false;
      } else if (movementFilter === 'IN_ONLY') {
        if (tx.flow !== 'IN') return false;
      } else if (movementFilter === 'OUT_ONLY') {
        if (tx.flow !== 'OUT') return false;
      }

      return true;
    });

    return result;
  }, [unifiedAllTransactions, searchTerm, categoryFilter, movementFilter]);

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

  // Date formatting helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(dateStr);
    }
  };

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

  // Comprehensive Excel Export Function (Includes WIP and Free Stock)
  const handleExportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Material-wise IN-OUT Summary
      const summaryRows = filteredMaterials.map(m => {
        const cur = Number(m.currentStock || 0);
        const wip = Number(m.inProgressStock || 0);
        const free = m.availableStock !== undefined ? Number(m.availableStock) : Math.max(0, cur - wip);

        return {
          'RM Code': m.code || '—',
          'Raw Material Name': m.name || '—',
          'Category': m.category || '—',
          'UOM': m.uom || '—',
          'Total In-Hand Stock': cur,
          'In-Progress Stock (Floor WIP)': wip,
          'Available Stock (Free for Orders)': free,
          [`Period IN (${period})`]: m.periodInQty || 0,
          [`Period OUT (${period})`]: m.periodOutQty || 0,
          'Net Period Movement': m.netMovement || 0,
          'Rate (₹/Unit)': m.ratePerUnit || 0,
          'Total Valuation (₹)': m.valuation || 0,
          'Stock Status': m.status || '—',
          'Active WIP Run': wip > 0 ? 'YES (In Progress)' : 'NO',
          'Latest PO': m.poReferenceNo || 'N/A',
          'Last In Date': m.lastIn ? formatDate(m.lastIn.date) : '—',
          'Last In Ref': m.lastIn?.ref || '—',
          'Last In Qty': m.lastIn?.qty || '—',
          'Last Out Date': m.lastOut ? formatDate(m.lastOut.date) : '—',
          'Last Out Ref': m.lastOut?.ref || '—',
          'Last Out Qty': m.lastOut?.qty || '—'
        };
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'RM In-Out Summary');

      // Sheet 2: Detailed Date-Wise Transactions
      if (filteredTransactions.length > 0) {
        const txRows = filteredTransactions.map(tx => ({
          'Date & Time': formatDateTime(tx.date),
          'Flow': tx.flow,
          'Status': tx.isInProgress ? 'IN PROGRESS (WIP RUN)' : 'COMPLETED',
          'Type': tx.typeLabel,
          'RM Code': tx.rawMaterialCode,
          'Raw Material Name': tx.rawMaterialName,
          'Category': tx.category,
          'UOM': tx.uom,
          'Inward Qty (IN)': tx.flow === 'IN' ? tx.quantity : 0,
          'Outward Qty (OUT)': tx.flow === 'OUT' ? tx.quantity : 0,
          'Floor WIP Allocated': tx.isInProgress ? tx.quantity : 0,
          'Reference No': tx.referenceNo,
          'PO Reference': tx.poReferenceNo || '—',
          'Batch / Lot No': tx.batchNumber || '—',
          'Party / Destination': tx.partyName || '—',
          'Handled By': tx.user || '—',
          'Notes': tx.notes || '—'
        }));

        const wsTx = XLSX.utils.json_to_sheet(txRows);
        XLSX.utils.book_append_sheet(wb, wsTx, 'Date-Wise In-Out Ledger');
      }

      const fileName = `RM_IN_OUT_Stock_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      Swal.fire({
        icon: 'success',
        title: 'Excel Report Exported!',
        text: `Exported ${filteredMaterials.length} materials with In-Hand, WIP & Free stock to ${fileName}`,
        timer: 3500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      console.error('Export error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Export Failed',
        text: err.message || 'Could not export Excel report.'
      });
    }
  };

  const isAnyLoading = isBaseLoading;
  const isAnyFetching = isBaseFetching || isDedicatedFetching;

  return (
    <div className="w-full min-h-screen bg-slate-50/60 dark:bg-slate-950 p-3 sm:p-5 md:p-6 space-y-5 transition-colors">
      {/* ── TOP HEADER & ACTIONS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <Boxes className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              RM-IN-OUT Stock
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              Stock In & Out Ledger
            </span>
            {summary.totalInProgressStock > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Active Floor WIP: {summary.totalInProgressStock}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Raw material date-wise inward, outward, active production WIP tracking, adjustments & live stock audit
          </p>
        </div>

        {/* View Mode Toggle & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
            <button
              onClick={() => setViewMode('material')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'material'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Material Summary</span>
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'ledger'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Date-Wise Ledger</span>
            </button>
          </div>

          {/* Quick Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchBase();
              refetchDedicated();
            }}
            disabled={isAnyFetching}
            className="h-9 px-3 text-xs border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isAnyFetching ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </Button>

          {/* Export to Excel */}
          <Button
            variant="default"
            size="sm"
            onClick={handleExportToExcel}
            className="h-9 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* ── TIME PERIOD SELECTOR BAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Time Period Filter:
            </span>
          </div>

          {/* Quick Period Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'last_week', label: 'Last Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Date' }
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
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  period === p.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Form (Appears when 'custom' is selected) */}
        {period === 'custom' && (
          <form
            onSubmit={handleApplyCustomRange}
            className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-3 animate-in fade-in duration-200"
          >
            <div>
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                From Date:
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                To Date:
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
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
                  className="text-xs h-9 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* ── KPI EXECUTIVE STAT CARDS (WITH IN-HAND, WIP & FREE STOCK) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Live In-Hand Stock */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span className="font-medium">Total In-Hand</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-mono">
              {Number(summary.totalCurrentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Valuation:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                ₹{Number(summary.totalValuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: In-Progress Stock (WIP on Factory Floor) */}
        <Card className="border-amber-300 dark:border-amber-900/60 shadow-xs bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                In-Progress WIP
              </span>
              <Factory className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 font-mono">
              {Number(summary.totalInProgressStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
              Active floor batches
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Free Available Stock */}
        <Card className="border-emerald-200 dark:border-emerald-900/50 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs">
              <span className="font-semibold">Free Available</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
              {Number(summary.totalAvailableStock !== undefined ? summary.totalAvailableStock : Math.max(0, (summary.totalCurrentStock || 0) - (summary.totalInProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              Ready for new orders
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Period Total Inward (IN) */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs">
              <span className="font-semibold">Period Inward (IN)</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
              +{Number(summary.totalPeriodIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              GRN receipts & additions
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Period Total Outward (OUT) */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs">
              <span className="font-semibold">Period Outward (OUT)</span>
              <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-rose-700 dark:text-rose-300 font-mono">
              -{Number(summary.totalPeriodOut || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Production, sales & waste
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Net Period Movement */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span className="font-medium">Net Movement</span>
              {Number(summary.netMovement || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              )}
            </div>
            <div className={`text-lg sm:text-xl font-bold font-mono ${
              Number(summary.netMovement || 0) >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {Number(summary.netMovement || 0) > 0 ? '+' : ''}
              {Number(summary.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {Number(summary.netMovement || 0) >= 0 ? 'Net Inflow (+)' : 'Net Drawdown (-)'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── TOOLBAR: SEARCH, CATEGORY, STATUS & SORT ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, name, category, PO, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-8 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value="ALL">All Categories ({unifiedMaterials.length})</option>
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 3. Movement / Stock Filter (With WIP Floor Runs Option) */}
          <div>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value="ALL">All Movement Status</option>
              <option value="IN_PROGRESS">🟡 In-Progress WIP (Floor Runs)</option>
              <option value="WITH_MOVEMENT">With Movement In Period</option>
              <option value="IN_ONLY">Inward Only (IN &gt; 0)</option>
              <option value="OUT_ONLY">Outward Only (OUT &gt; 0)</option>
              <option value="NET_POSITIVE">Net Positive (+ Movement)</option>
              <option value="NET_NEGATIVE">Net Drawdown (- Movement)</option>
              <option value="LOW_STOCK">Low Stock Warning</option>
              <option value="OUT_OF_STOCK">Out of Stock (Zero)</option>
            </select>
          </div>

          {/* 4. Sorting Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value="code_asc">Code (Ascending: RM-00001)</option>
              <option value="code_desc">Code (Descending)</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="stock_desc">In-Hand Stock (High → Low)</option>
              <option value="stock_asc">In-Hand Stock (Low → High)</option>
              <option value="wip_desc">In-Progress WIP (High → Low)</option>
              <option value="in_desc">Period IN Qty (High → Low)</option>
              <option value="out_desc">Period OUT Qty (High → Low)</option>
              <option value="net_desc">Net Movement (+ to -)</option>
              <option value="valuation_desc">Valuation (High → Low)</option>
            </select>

            {(searchTerm || categoryFilter !== 'ALL' || movementFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('ALL');
                  setMovementFilter('ALL');
                  setSortBy('code_asc');
                }}
                className="h-9 px-2 text-xs border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Pills Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Showing:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {viewMode === 'material' ? filteredMaterials.length : filteredTransactions.length} records
            </span>
            <span>• Period:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
              {period.replace('_', ' ')}
            </span>
            {movementFilter === 'IN_PROGRESS' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold text-[10px]">
                🟡 Filtered: In-Progress WIP Only
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            Last Refreshed: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      {viewMode === 'material' ? (
        /* ============================================================== */
        /* MODE 1: MATERIAL-WISE SUMMARY TABLE WITH EXPANDABLE IN-ROW LEDGER */
        /* ============================================================== */
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <TableHead className="w-10 text-center"></TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[110px]">
                    Code
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[200px]">
                    Raw Material Name
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[130px]">
                    Category & UOM
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 text-right min-w-[145px]">
                    Current Stock & WIP
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-emerald-700 dark:text-emerald-400 text-right min-w-[130px]">
                    Period IN
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-rose-700 dark:text-rose-400 text-right min-w-[130px]">
                    Period OUT
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 text-right min-w-[120px]">
                    Net Flow
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 text-right min-w-[120px]">
                    Valuation
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 text-center min-w-[160px]">
                    Actions & History
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAnyLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={10} className="py-4">
                        <Skeleton className="h-6 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium">No raw materials match the current filters.</p>
                        <p className="text-xs text-slate-500">Try adjusting your search keyword, category, or time period.</p>
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

                    return (
                      <React.Fragment key={mat.id}>
                        {/* Main Item Row */}
                        <TableRow
                          className={`text-xs transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 ${
                            isExpanded ? 'bg-slate-50/90 dark:bg-slate-800/50' : ''
                          } ${hasWip ? 'border-l-4 border-l-amber-500' : ''}`}
                        >
                          {/* 0. Expand Button */}
                          <TableCell className="text-center py-2.5 px-1">
                            <button
                              onClick={() => toggleExpandRow(mat.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title={isExpanded ? 'Collapse ledger' : 'Expand date-wise in/out breakdown'}
                            >
                              {isLoadingHistory ? (
                                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </TableCell>

                          {/* 1. Code */}
                          <TableCell className="font-mono font-semibold py-2.5">
                            <button
                              onClick={() => handleOpenHistory(mat.id)}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline hover:text-emerald-800 text-left font-bold"
                              title="Click to view full lifecycle audit drawer"
                            >
                              {mat.code || '—'}
                            </button>
                            {hasWip && (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  WIP Run
                                </span>
                              </div>
                            )}
                          </TableCell>

                          {/* 2. Raw Material Name */}
                          <TableCell className="py-2.5">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {mat.name || '—'}
                            </div>
                            {mat.poReferenceNo && (
                              <button
                                onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5"
                                title="Redirect to Purchase Order"
                              >
                                <span>PO: {mat.poReferenceNo}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </TableCell>

                          {/* 3. Category & UOM */}
                          <TableCell className="py-2.5">
                            <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {mat.category || 'Uncategorised'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              Unit: {mat.uom || 'Unit'}
                            </div>
                          </TableCell>

                          {/* 4. Current Stock, In-Progress WIP & Free Available Stock */}
                          <TableCell className="text-right py-2.5 font-mono">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {Number(mat.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              <span className="text-[10px] text-slate-400 font-normal ml-1">{mat.uom}</span>
                            </div>
                            {hasWip ? (
                              <div className="flex flex-col items-end gap-1 mt-1">
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-bold border border-amber-300/80 dark:border-amber-800 shadow-2xs"
                                  title="Material currently committed to active batches on the floor"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  WIP: {Number(mat.inProgressStock).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {mat.uom}
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 font-bold border border-emerald-300/80 dark:border-emerald-800 shadow-2xs"
                                  title="Free available stock remaining for new production orders"
                                >
                                  Free: {Number(mat.availableStock !== undefined ? mat.availableStock : Math.max(0, (mat.currentStock || 0) - (mat.inProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {mat.uom}
                                </span>
                              </div>
                            ) : isOut ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-semibold">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold">
                                Low Stock
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400">
                                In Hand (100% Free)
                              </span>
                            )}
                          </TableCell>

                          {/* 5. Period IN */}
                          <TableCell className="text-right py-2.5 font-mono">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              +{Number(mat.periodInQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {mat.lastIn ? (
                              <button
                                onClick={() => {
                                  if (mat.lastIn.poId) handleRedirectToPO(mat.lastIn.poId, mat.lastIn.ref);
                                  else if (mat.lastIn.grnId) handleRedirectToGRN(mat.lastIn.grnId, mat.lastIn.ref);
                                }}
                                className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 hover:underline block text-right truncate max-w-[130px] ml-auto"
                                title={`Last In: ${mat.lastIn.party} on ${formatDate(mat.lastIn.date)}`}
                              >
                                {mat.lastIn.ref}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">None in period</span>
                            )}
                          </TableCell>

                          {/* 6. Period OUT */}
                          <TableCell className="text-right py-2.5 font-mono">
                            <div className="font-bold text-rose-600 dark:text-rose-400">
                              -{Number(mat.periodOutQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                            {mat.lastOut ? (
                              <div
                                className="text-[10px] text-rose-600/80 dark:text-rose-400/80 text-right truncate max-w-[130px] ml-auto"
                                title={`Last Out: ${mat.lastOut.party} on ${formatDate(mat.lastOut.date)}`}
                              >
                                {mat.lastOut.ref}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">None in period</span>
                            )}
                          </TableCell>

                          {/* 7. Net Movement */}
                          <TableCell className="text-right py-2.5 font-mono">
                            <span className={`inline-block px-1.5 py-0.5 rounded-sm font-semibold text-[11px] ${
                              Number(mat.netMovement || 0) > 0
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : Number(mat.netMovement || 0) < 0
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'text-slate-400'
                            }`}>
                              {Number(mat.netMovement || 0) > 0 ? '+' : ''}
                              {Number(mat.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>

                          {/* 8. Valuation */}
                          <TableCell className="text-right py-2.5 font-mono">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              ₹{Number(mat.valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              @ ₹{Number(mat.ratePerUnit || 0).toFixed(2)}
                            </div>
                          </TableCell>

                          {/* 9. Actions */}
                          <TableCell className="text-center py-2.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View Full History Drawer */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenHistory(mat.id)}
                                className="h-7 px-2 text-[11px] border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Open full history drawer with timeline, batches & QC"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                <span>History</span>
                              </Button>

                              {/* Stock Query Modal */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenStockQuery(mat.id)}
                                className="h-7 px-2 text-[11px] border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Open Tally-Prime style instant stock query sheet"
                              >
                                <span>Query</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Inline Expandable Date-Wise Sub-Table */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                            <TableCell colSpan={10} className="p-3 sm:p-4">
                              <div className="space-y-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-inner">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      Date-Wise In-Out Movements for {mat.name} ({mat.code})
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                      {mat.transactions?.length || 0} Movements in Period
                                    </span>
                                    {hasWip && (
                                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        🟡 Floor WIP: {mat.inProgressStock} {mat.uom} Allocated to Active Batch
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {mat.poReferenceNo && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                                        className="h-7 text-[11px] border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                                      >
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        Redirect to PO ({mat.poReferenceNo})
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenHistory(mat.id)}
                                      className="h-7 text-[11px] border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                                    >
                                      Full Lifecycle Audit
                                    </Button>
                                  </div>
                                </div>

                                {isLoadingHistory ? (
                                  <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                                    <span>Loading chronological date movements from warehouse database...</span>
                                  </div>
                                ) : mat.transactions && mat.transactions.length > 0 ? (
                                  <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-slate-100/60 dark:bg-slate-800/40 text-[11px]">
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[120px]">
                                            Date & Time
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[110px]">
                                            Flow & Status
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[160px]">
                                            Transaction Type
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[130px]">
                                            Document Ref
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                                            Batch / Lot
                                          </TableHead>
                                          <TableHead className="font-semibold text-emerald-700 dark:text-emerald-400 text-right min-w-[90px]">
                                            Inward (IN)
                                          </TableHead>
                                          <TableHead className="font-semibold text-rose-700 dark:text-rose-400 text-right min-w-[110px]">
                                            Outward (OUT)
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[150px]">
                                            Party / Destination
                                          </TableHead>
                                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
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
                                            String(tx.typeLabel || '').includes('In Progress') ||
                                            String(tx.notes || '').toLowerCase().includes('in progress')
                                          );

                                          return (
                                            <TableRow
                                              key={tx.id}
                                              className={`text-[11px] transition-colors border-b ${
                                                isInProgress
                                                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-900/60'
                                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800/80'
                                              }`}
                                            >
                                              <TableCell className="font-mono py-2 text-slate-600 dark:text-slate-400">
                                                {formatDateTime(tx.date)}
                                              </TableCell>
                                              <TableCell className="py-2">
                                                {isInProgress ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    🟡 IN PROGRESS
                                                  </span>
                                                ) : (
                                                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    isIn
                                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                  }`}>
                                                    {isIn ? '🟢 IN' : '🔴 OUT'}
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-medium py-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span>{tx.typeLabel}</span>
                                                  {isInProgress && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 font-bold uppercase tracking-wider">
                                                      Floor WIP
                                                    </span>
                                                  )}
                                                </div>
                                              </TableCell>
                                              <TableCell className="font-mono py-2">
                                                {tx.poId ? (
                                                  <button
                                                    onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                  </button>
                                                ) : tx.grnId ? (
                                                  <button
                                                    onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                                                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                  </button>
                                                ) : tx.batchId || isInProgress ? (
                                                  <button
                                                    onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                                                    className={`flex items-center gap-1 font-semibold hover:underline ${
                                                      isInProgress
                                                        ? 'text-amber-700 dark:text-amber-400 font-bold'
                                                        : 'text-purple-600 dark:text-purple-400'
                                                    }`}
                                                    title={isInProgress ? 'Batch is actively running in production. Click to view.' : 'View batch'}
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                  </button>
                                                ) : tx.orderId ? (
                                                  <button
                                                    onClick={() => navigate('/sales/order')}
                                                    className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                                                  >
                                                    <span>{tx.referenceNo}</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                  </button>
                                                ) : (
                                                  <span>{tx.referenceNo || '—'}</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-mono text-slate-500 dark:text-slate-400 py-2">
                                                {tx.batchNumber || '—'}
                                              </TableCell>
                                              <TableCell className="text-right font-mono font-bold py-2 text-emerald-600 dark:text-emerald-400">
                                                {isIn ? `+${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                                              </TableCell>
                                              <TableCell className={`text-right font-mono font-bold py-2 ${
                                                isInProgress ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                              }`}>
                                                {!isIn ? (
                                                  <div>
                                                    <span>-{Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                                    {isInProgress && (
                                                      <div className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                                                        WIP Allocated
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : '—'}
                                              </TableCell>
                                              <TableCell className="py-2 text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                                                {tx.partyName || '—'}
                                                {isInProgress && (
                                                  <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                                    (Batch In Progress)
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-2 text-slate-500 dark:text-slate-400">
                                                {tx.user || '—'}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="py-6 text-center text-slate-400 text-xs">
                                    No transaction movements recorded for this material within the selected time period ({period}). Click 'Full Lifecycle Audit' to check all historical records.
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
                <div key={idx} className="p-4 space-y-3">
                  <Skeleton className="h-5 w-2/3 rounded-sm" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ))
            ) : paginatedMaterials.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No raw materials match the current filters.</div>
            ) : (
              paginatedMaterials.map((mat) => {
                const isExpanded = expandedMaterialIds.has(mat.id);
                const isLoadingHistory = expandedLoadingIds.has(mat.id);
                const isLow = mat.status === 'LOW_STOCK';
                const isOut = mat.status === 'OUT_OF_STOCK';
                const hasWip = Number(mat.inProgressStock || 0) > 0;

                return (
                  <div
                    key={mat.id}
                    className={`p-3.5 space-y-3 bg-white dark:bg-slate-900 transition-colors ${
                      hasWip ? 'border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenHistory(mat.id)}
                            className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {mat.code}
                          </button>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {mat.category}
                          </span>
                          {hasWip ? (
                            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              WIP Run
                            </span>
                          ) : isOut ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-semibold">
                              Out
                            </span>
                          ) : isLow ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold">
                              Low
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-medium">
                              Optimal
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

                    {/* Quick Metrics Grid (Shows In Hand, Floor WIP, Free Stock & Net Flow) */}
                    <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 block truncate">In-Hand</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {Number(mat.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 block truncate font-semibold">
                          WIP Floor
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {Number(mat.inProgressStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block truncate font-semibold">
                          Free Stock
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(mat.availableStock !== undefined ? mat.availableStock : Math.max(0, (mat.currentStock || 0) - (mat.inProgressStock || 0))).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block truncate">Net Period</span>
                        <span className={`font-mono font-bold ${
                          Number(mat.netMovement || 0) > 0 ? 'text-emerald-600' : Number(mat.netMovement || 0) < 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {Number(mat.netMovement || 0) > 0 ? '+' : ''}{Number(mat.netMovement || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Actions Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => toggleExpandRow(mat.id)}
                        className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium"
                      >
                        {isLoadingHistory ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>{isExpanded ? 'Hide Ledger' : 'View Movements'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenHistory(mat.id)}
                          className="h-7 px-2 text-[11px] border-slate-300 dark:border-slate-700"
                        >
                          <Eye className="w-3 h-3 mr-1 text-emerald-600" />
                          History
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenStockQuery(mat.id)}
                          className="h-7 px-1.5 text-[11px]"
                        >
                          Query
                        </Button>
                      </div>
                    </div>

                    {/* Inline Expanded Movements for Mobile */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Movements ({mat.transactions?.length || 0})</span>
                          {mat.poReferenceNo && (
                            <button
                              onClick={() => handleRedirectToPO(mat.latestPoId, mat.poReferenceNo)}
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              PO: {mat.poReferenceNo} <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        {isLoadingHistory ? (
                          <div className="py-4 text-center text-xs text-slate-400">Loading movements...</div>
                        ) : mat.transactions && mat.transactions.length > 0 ? (
                          <div className="space-y-1.5">
                            {mat.transactions.map((tx) => {
                              const isIn = tx.flow === 'IN';
                              const isInProgress = Boolean(
                                tx.isInProgress ||
                                tx.batchStatus === 'IN_PROGRESS' ||
                                String(tx.typeLabel || '').includes('In Progress')
                              );

                              return (
                                <div
                                  key={tx.id}
                                  className={`p-2 rounded-md text-[11px] space-y-1 border ${
                                    isInProgress
                                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 border-l-4 border-l-amber-500'
                                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-mono">
                                    <span className="text-slate-500">{formatDate(tx.date)}</span>
                                    {isInProgress ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        🟡 -{tx.quantity} WIP
                                      </span>
                                    ) : (
                                      <span className={`px-1.5 py-0.2 rounded-sm font-bold text-[10px] ${
                                        isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {isIn ? `+${tx.quantity} IN` : `-${tx.quantity} OUT`}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {tx.typeLabel}
                                    </span>
                                    <span className="font-mono text-slate-400 text-[10px]">
                                      {tx.referenceNo}
                                    </span>
                                  </div>
                                  <div className="text-slate-500 truncate text-[10px]">
                                    {tx.partyName}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-2 text-center text-[11px] text-slate-400">No movements recorded in this period.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalMaterialPages}
              totalRecords={filteredMaterials.length}
              pageSize={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(newSize) => {
                setItemsPerPage(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </Card>
      ) : (
        /* ============================================================== */
        /* MODE 2: GLOBAL DATE-WISE TRANSACTION STREAM LEDGER             */
        /* ============================================================== */
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[130px]">
                    Date & Time
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 text-center min-w-[110px]">
                    Flow & Status
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[150px]">
                    Transaction Type
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[100px]">
                    RM Code
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[180px]">
                    Raw Material Name
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[130px]">
                    Document Ref
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-200 min-w-[100px]">
                    Batch / Lot
                  </TableHead>
                  <TableHead className="font-semibold text-emerald-700 dark:text-emerald-400 text-right min-w-[100px]">
                    Inward (IN)
                  </TableHead>
                  <TableHead className="font-semibold text-rose-700 dark:text-rose-400 text-right min-w-[110px]">
                    Outward (OUT)
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 min-w-[160px]">
                    Party / Destination
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-200 min-w-[100px]">
                    User
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAnyLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={11} className="py-4">
                        <Skeleton className="h-6 w-full rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium">No transactions recorded for this period.</p>
                        <p className="text-xs text-slate-500">
                          Try choosing 'All Time' or expanding items in Material Summary view.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isIn = tx.flow === 'IN';
                    const isInProgress = Boolean(
                      tx.isInProgress ||
                      tx.batchStatus === 'IN_PROGRESS' ||
                      String(tx.typeLabel || '').includes('In Progress')
                    );

                    return (
                      <TableRow
                        key={tx.id}
                        className={`text-xs border-b transition-colors ${
                          isInProgress
                            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-l-4 border-l-amber-500 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-900/60'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        {/* 1. Date */}
                        <TableCell className="font-mono text-slate-600 dark:text-slate-400 py-2.5">
                          {formatDateTime(tx.date)}
                        </TableCell>

                        {/* 2. Flow Badge & WIP Indicator */}
                        <TableCell className="text-center py-2.5">
                          {isInProgress ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              🟡 IN PROGRESS
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {isIn ? '🟢 IN' : '🔴 OUT'}
                            </span>
                          )}
                        </TableCell>

                        {/* 3. Transaction Type */}
                        <TableCell className="font-medium py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{tx.typeLabel}</span>
                            {isInProgress && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 font-bold uppercase tracking-wider">
                                Floor WIP
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 4. RM Code */}
                        <TableCell className="font-mono font-semibold py-2.5">
                          <button
                            onClick={() => handleOpenHistory(tx.rawMaterialId)}
                            className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
                            title="Open history drawer for this raw material"
                          >
                            {tx.rawMaterialCode}
                          </button>
                        </TableCell>

                        {/* 5. Raw Material Name */}
                        <TableCell className="py-2.5">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                            {tx.rawMaterialName}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {tx.category} • {tx.uom}
                          </div>
                        </TableCell>

                        {/* 6. Document Ref (Clickable Redirection) */}
                        <TableCell className="font-mono py-2.5">
                          {tx.poId ? (
                            <button
                              onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                              title="Redirect to Purchase Order"
                            >
                              <span>{tx.referenceNo}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ) : tx.grnId ? (
                            <button
                              onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                              title="Redirect to GRN inspection"
                            >
                              <span>{tx.referenceNo}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ) : tx.batchId || isInProgress ? (
                            <button
                              onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                              className={`hover:underline flex items-center gap-1 font-semibold ${
                                isInProgress
                                  ? 'text-amber-700 dark:text-amber-400 font-bold'
                                  : 'text-purple-600 dark:text-purple-400'
                              }`}
                              title={isInProgress ? 'Production batch is currently running. Click to view.' : 'Redirect to Production Batches'}
                            >
                              <span>{tx.referenceNo}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ) : tx.orderId ? (
                            <button
                              onClick={() => navigate('/sales/order')}
                              className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                              title="Redirect to Customer Sales Order"
                            >
                              <span>{tx.referenceNo}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ) : (
                            <span className="text-slate-700 dark:text-slate-300">{tx.referenceNo || '—'}</span>
                          )}
                        </TableCell>

                        {/* 7. Batch No */}
                        <TableCell className="font-mono text-slate-500 dark:text-slate-400 py-2.5">
                          {tx.batchNumber || '—'}
                        </TableCell>

                        {/* 8. Inward Qty */}
                        <TableCell className="text-right font-mono font-bold py-2.5 text-emerald-600 dark:text-emerald-400">
                          {isIn ? `+${Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </TableCell>

                        {/* 9. Outward Qty */}
                        <TableCell className={`text-right font-mono font-bold py-2.5 ${
                          isInProgress ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {!isIn ? (
                            <div>
                              <span>-{Number(tx.quantity).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                              {isInProgress && (
                                <div className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                                  WIP Allocated
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </TableCell>

                        {/* 10. Party / Destination */}
                        <TableCell className="py-2.5 text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                          {tx.partyName || '—'}
                          {isInProgress && (
                            <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                              (Batch In Progress)
                            </span>
                          )}
                        </TableCell>

                        {/* 11. Handled By */}
                        <TableCell className="py-2.5 text-slate-500 dark:text-slate-400">
                          {tx.user || '—'}
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
                <div key={idx} className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/3 rounded-sm" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ))
            ) : paginatedTransactions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No movements recorded for this period.
              </div>
            ) : (
              paginatedTransactions.map((tx) => {
                const isIn = tx.flow === 'IN';
                const isInProgress = Boolean(
                  tx.isInProgress ||
                  tx.batchStatus === 'IN_PROGRESS' ||
                  String(tx.typeLabel || '').includes('In Progress')
                );

                return (
                  <div
                    key={tx.id}
                    className={`p-3.5 space-y-2 bg-white dark:bg-slate-900 transition-colors ${
                      isInProgress ? 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500 dark:text-slate-400">{formatDateTime(tx.date)}</span>
                      {isInProgress ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          🟡 -{tx.quantity} WIP
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isIn
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {isIn ? `+${tx.quantity} IN` : `-${tx.quantity} OUT`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {tx.rawMaterialName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {tx.rawMaterialCode} • {tx.category} • {tx.uom}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded-sm font-semibold ${
                          isInProgress
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {tx.typeLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="font-mono text-slate-600 dark:text-slate-400">
                        Ref: {tx.poId ? (
                          <button
                            onClick={() => handleRedirectToPO(tx.poId, tx.referenceNo)}
                            className="text-blue-600 hover:underline font-bold"
                          >
                            {tx.referenceNo}
                          </button>
                        ) : tx.grnId ? (
                          <button
                            onClick={() => handleRedirectToGRN(tx.grnId, tx.referenceNo)}
                            className="text-emerald-600 hover:underline font-bold"
                          >
                            {tx.referenceNo}
                          </button>
                        ) : tx.batchId || isInProgress ? (
                          <button
                            onClick={() => handleRedirectToBatch(tx.batchId, tx.referenceNo)}
                            className="text-amber-700 hover:underline font-bold"
                          >
                            {tx.referenceNo}
                          </button>
                        ) : (
                          <span>{tx.referenceNo}</span>
                        )}
                        {tx.batchNumber && <span className="text-slate-400 ml-1">({tx.batchNumber})</span>}
                      </div>

                      <div className="text-slate-500 text-[11px] truncate max-w-[150px]">
                        {tx.partyName || tx.user}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalTransactionPages}
              totalRecords={filteredTransactions.length}
              pageSize={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(newSize) => {
                setItemsPerPage(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </Card>
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

      {/* ── EMBEDDED TALLY PRIME STYLE RM STOCK QUERY MODAL ── */}
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

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { 
  Package, 
  Search, 
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  FileSpreadsheet, 
  IndianRupee,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import RMHistoryDrawer from '@/modules/purchase/components/RMHistoryDrawer';

export default function RMStockPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract navigation parameters from URL query string or route state
  const codeParam = searchParams.get('code') || location.state?.rmCode || '';
  const nameParam = searchParams.get('name') || location.state?.rmName || '';
  const searchURLParam = searchParams.get('search') || '';
  const materialIdParam = searchParams.get('materialId') || location.state?.materialId || '';
  const shouldOpenHistory = searchParams.get('openHistory') === 'true' || location.state?.openHistory === true;
  const batchParam = searchParams.get('batch') || location.state?.batchNumber || null;
  const initialTabParam = searchParams.get('tab') || location.state?.initialTab || 'grn';

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState(codeParam || nameParam || searchURLParam || '');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | OPTIMAL | LOW | OUT
  const [valuationFilter, setValuationFilter] = useState('ALL'); // ALL | PRICED | UNPRICED
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Sorting State - Default is Code Ascending (RM-00001 First), identical to /setup/raw-material
  const [sortBy, setSortBy] = useState('code_asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Tax view mode: 'both' | 'with_tax' | 'without_tax'
  const [taxViewMode, setTaxViewMode] = useState('both');

  const queryClient = useQueryClient();

  // History Drawer State
  const [selectedMaterialId, setSelectedMaterialId] = useState(materialIdParam || null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState(initialTabParam || 'grn');
  const [drawerTargetBatch, setDrawerTargetBatch] = useState(batchParam || null);

  const { data: stock = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rm-stock'],
    queryFn: async () => {
      const response = await api.get('/rm-stock');
      setLastRefreshed(new Date());
      return response.data;
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Extract distinct category list
  const categoryOptions = useMemo(() => {
    const set = new Set();
    stock.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stock]);

  // Handle incoming redirect parameters
  useEffect(() => {
    if (codeParam) {
      setSearchTerm(codeParam);
    } else if (nameParam) {
      setSearchTerm(nameParam);
    } else if (searchURLParam) {
      setSearchTerm(searchURLParam);
    }
  }, [codeParam, nameParam, searchURLParam]);

  useEffect(() => {
    if (shouldOpenHistory) {
      let targetId = materialIdParam || codeParam;
      if (stock && stock.length > 0) {
        const match = stock.find(item =>
          (materialIdParam && item.id === materialIdParam) ||
          (codeParam && item.code?.toLowerCase() === codeParam.toLowerCase()) ||
          (nameParam && item.name?.toLowerCase() === nameParam.toLowerCase())
        );
        if (match) {
          targetId = match.id;
        }
      }

      if (targetId) {
        setSelectedMaterialId(targetId);
        setDrawerInitialTab(initialTabParam || 'grn');
        setDrawerTargetBatch(batchParam || null);
        setIsHistoryOpen(true);
      }
    }
  }, [shouldOpenHistory, materialIdParam, codeParam, nameParam, batchParam, initialTabParam, stock]);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
    refetch();
  };

  const handleOpenHistory = (materialId, tab = 'timeline', batch = null) => {
    setSelectedMaterialId(materialId);
    setDrawerInitialTab(tab);
    setDrawerTargetBatch(batch);
    setIsHistoryOpen(true);
  };

  const handleCloseHistory = () => {
    setIsHistoryOpen(false);
    setSelectedMaterialId(null);
    setDrawerTargetBatch(null);

    if (searchParams.get('openHistory')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('openHistory');
      newParams.delete('batch');
      navigate({ search: newParams.toString() ? `?${newParams.toString()}` : '' }, { replace: true, state: {} });
    }
  };

  // Executive inventory valuation metrics
  const {
    totalValuationWithTax,
    totalValuationWithoutTax,
    totalGstAmount,
    pricedCount,
    unpricedCount
  } = useMemo(() => {
    let withTax = 0;
    let withoutTax = 0;
    let gst = 0;
    let priced = 0;
    let unpriced = 0;

    for (const item of stock) {
      if (item.hasPo) {
        priced++;
        withTax += Number(item.valueWithTax || item.value || 0);
        withoutTax += Number(item.valueWithoutTax || 0);
        gst += Number(item.taxValue || 0);
      } else {
        unpriced++;
      }
    }

    return {
      totalValuationWithTax: withTax,
      totalValuationWithoutTax: withoutTax,
      totalGstAmount: gst,
      pricedCount: priced,
      unpricedCount: unpriced
    };
  }, [stock]);

  // Reset pagination to first page when search, filter, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, valuationFilter, sortBy]);

  // Filter and Sort matching /setup/raw-material logic
  const sortedAndFiltered = useMemo(() => {
    let result = stock.filter(item => {
      // 1. Text Search across code, name, category, unit, poReferenceNo
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesTerm = (
          (item.name || '').toLowerCase().includes(term) ||
          (item.code || '').toLowerCase().includes(term) ||
          (item.category || '').toLowerCase().includes(term) ||
          (item.unit || '').toLowerCase().includes(term) ||
          (item.poReferenceNo || '').toLowerCase().includes(term)
        );
        if (!matchesTerm) return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'ALL') {
        if ((item.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. Stock Status Filter
      if (statusFilter === 'OPTIMAL') {
        if (Number(item.availableQuantity || 0) <= Number(item.alertLevel || 0)) return false;
      } else if (statusFilter === 'LOW') {
        const qty = Number(item.availableQuantity || 0);
        const alert = Number(item.alertLevel || 0);
        if (!(qty <= alert && qty > 0)) return false;
      } else if (statusFilter === 'OUT') {
        if (Number(item.availableQuantity || 0) > 0) return false;
      }

      // 4. Valuation / PO Status Filter
      if (valuationFilter === 'PRICED') {
        if (!item.hasPo) return false;
      } else if (valuationFilter === 'UNPRICED') {
        if (item.hasPo) return false;
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
      if (sortBy === 'category_desc') {
        return (b.category || '').localeCompare(a.category || '', undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'quantity_desc') {
        return Number(b.availableQuantity || 0) - Number(a.availableQuantity || 0);
      }
      if (sortBy === 'quantity_asc') {
        return Number(a.availableQuantity || 0) - Number(b.availableQuantity || 0);
      }
      if (sortBy === 'floating_desc') {
        return Number(b.floatingStock || 0) - Number(a.floatingStock || 0);
      }
      if (sortBy === 'floating_asc') {
        return Number(a.floatingStock || 0) - Number(b.floatingStock || 0);
      }
      if (sortBy === 'rate_desc') {
        return Number(b.rateWithTax || b.ratePerUnit || 0) - Number(a.rateWithTax || a.ratePerUnit || 0);
      }
      if (sortBy === 'rate_asc') {
        return Number(a.rateWithTax || a.ratePerUnit || 0) - Number(b.rateWithTax || b.ratePerUnit || 0);
      }
      if (sortBy === 'value_with_tax_desc' || sortBy === 'value_desc') {
        return Number(b.valueWithTax || b.value || 0) - Number(a.valueWithTax || a.value || 0);
      }
      if (sortBy === 'value_with_tax_asc' || sortBy === 'value_asc') {
        return Number(a.valueWithTax || a.value || 0) - Number(b.valueWithTax || b.value || 0);
      }
      if (sortBy === 'value_without_tax_desc') {
        return Number(b.valueWithoutTax || 0) - Number(a.valueWithoutTax || 0);
      }
      if (sortBy === 'latest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      }
      return 0;
    });

    return result;
  }, [stock, searchTerm, categoryFilter, statusFilter, valuationFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(sortedAndFiltered.length / itemsPerPage) || 1;
  const paginatedStock = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  // Header quick sort toggle helpers
  const handleToggleSortCode = () => {
    setSortBy(prev => (prev === 'code_asc' ? 'code_desc' : 'code_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortCategory = () => {
    setSortBy(prev => (prev === 'category_asc' ? 'category_desc' : 'category_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortName = () => {
    setSortBy(prev => (prev === 'name_asc' ? 'name_desc' : 'name_asc'));
    setCurrentPage(1);
  };

  const handleToggleSortQty = () => {
    setSortBy(prev => (prev === 'quantity_desc' ? 'quantity_asc' : 'quantity_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortFloating = () => {
    setSortBy(prev => (prev === 'floating_desc' ? 'floating_asc' : 'floating_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortRate = () => {
    setSortBy(prev => (prev === 'rate_desc' ? 'rate_asc' : 'rate_desc'));
    setCurrentPage(1);
  };

  const handleToggleSortValue = () => {
    setSortBy(prev => (prev === 'value_with_tax_desc' ? 'value_with_tax_asc' : 'value_with_tax_desc'));
    setCurrentPage(1);
  };

  // Check if any filter or non-default sort is active
  const isFilterActive = searchTerm !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || valuationFilter !== 'ALL' || sortBy !== 'code_asc';

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setValuationFilter('ALL');
    setSortBy('code_asc');
    setCurrentPage(1);
  };

  const handleExportAllStockExcel = () => {
    if (!sortedAndFiltered || sortedAndFiltered.length === 0) return;
    const exportData = sortedAndFiltered.map((item, idx) => ({
      'SN': idx + 1,
      'Material Code': item.code,
      'Category': item.category || 'Uncategorised',
      'Material Name': item.name,
      'Available Quantity': item.availableQuantity,
      'Unit': item.unit,
      'Floating Stock': item.floatingStock,
      'Valuation Status': item.hasPo ? 'PO DERIVED PRICING' : 'AWAITING PO (UNVALUED)',
      'PO Reference No': item.poReferenceNo || 'N/A',
      'PO Date': item.poDate ? new Date(item.poDate).toLocaleDateString('en-IN') : 'N/A',
      'PO Line Quantity': item.poLineQty ?? 'N/A',
      'Derived Rate Excl. Tax (INR)': item.hasPo ? Number(item.rateWithoutTax || 0) : 0,
      'GST %': item.hasPo ? `${item.gstPercentage || 0}%` : '0%',
      'Derived Rate Incl. Tax (INR)': item.hasPo ? Number(item.rateWithTax || 0) : 0,
      'Stock Value Excl. Tax (INR)': item.hasPo ? Number(item.valueWithoutTax || 0) : 0,
      'Stock GST Amount (INR)': item.hasPo ? Number(item.taxValue || 0) : 0,
      'Total Stock Value Incl. Tax (INR)': item.hasPo ? Number(item.valueWithTax || 0) : 0,
      'Master Catalog Rate (Ignored for Valuation)': item.masterStandardRate || 0,
      'Alert Level': item.alertLevel,
      'Stock Status': Number(item.availableQuantity || 0) <= Number(item.alertLevel || 0) ? 'LOW STOCK ALERT' : 'OPTIMAL'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RM Stock Inventory');
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `RM_Stock_Inventory_${dateStamp}.xlsx`);
  };

  return (
    <div className="w-full px-3 sm:px-4 py-2.5 space-y-2.5 mx-auto transition-all duration-200">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800 shadow-3xs shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Raw Material Stock
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                {stock.length} {stock.length === 1 ? 'Material' : 'Materials'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Real-time inventory stock valuation dynamically derived strictly from Purchase Orders (PO).
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
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isFetching ? 'Syncing...' : 'Sync'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAllStockExcel}
            className="h-8 px-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-3xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Value With Tax */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 shadow-3xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400">
              Total Value (With Tax)
            </span>
            <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              <IndianRupee className="w-3 h-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
            ₹{totalValuationWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            PO-Derived Gross Inventory Value
          </div>
        </div>

        {/* Card 2: Value Without Tax */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-slate-900 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/60 shadow-3xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-400">
              Net Value (Excl. Tax)
            </span>
            <span className="p-1 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              <IndianRupee className="w-3 h-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
            ₹{totalValuationWithoutTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Base Purchase Rate Valuation
          </div>
        </div>

        {/* Card 3: GST Amount */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-500/20 dark:via-slate-900 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/60 shadow-3xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-400">
              Total Stock GST / Tax
            </span>
            <span className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
              <IndianRupee className="w-3 h-3" />
            </span>
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
            ₹{totalGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Cumulative GST on Hand
          </div>
        </div>

        {/* Card 4: PO Pricing Coverage */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-800/60 shadow-3xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">
              Valuation Policy
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold font-mono">
              {pricedCount}/{stock.length} POs
            </span>
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{pricedCount} PO Priced</span>
            <span className="text-xs text-slate-400 font-normal">•</span>
            <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">{unpricedCount} Pending PO</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Master rate excluded • 100% PO derived
          </div>
        </div>
      </div>

      {/* Tax Perspective Filter Pill & Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 py-0.5">
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTaxViewMode('both')}
            className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
              taxViewMode === 'both'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Dual Tax View
          </button>
          <button
            type="button"
            onClick={() => setTaxViewMode('with_tax')}
            className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
              taxViewMode === 'with_tax'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            With Tax (Gross) Only
          </button>
          <button
            type="button"
            onClick={() => setTaxViewMode('without_tax')}
            className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
              taxViewMode === 'without_tax'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-3xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Without Tax (Base) Only
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            PO Line Rate
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
            Master Rate Ignored
          </span>
        </div>
      </div>

      {/* Main Stock Table Card matching /setup/raw-material */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col text-xs">
        <CardContent className="p-0">
          {/* Integrated Pro Toolbar: Search + Category + Status + Valuation + Sort + Reset */}
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
            {/* Search Input with quick clear and match counter */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, name, category, unit, PO..."
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
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {searchTerm && (
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap hidden sm:inline-flex items-center gap-1">
                  <span>Found {sortedAndFiltered.length} matches</span>
                </div>
              )}
            </div>

            {/* Filter Dropdowns & Sort Controls */}
            <div className="flex items-center gap-1.5 flex-wrap justify-start lg:justify-end">
              {/* Category Filter */}
              <div className="relative flex items-center">
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Filter by Category"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Stock Status Filter */}
              <div className="relative flex items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Filter by Stock Status"
                >
                  <option value="ALL">All Stock Status</option>
                  <option value="OPTIMAL">Optimal Stock</option>
                  <option value="LOW">Low Stock Alert</option>
                  <option value="OUT">Out of Stock (0)</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Valuation Filter */}
              <div className="relative flex items-center">
                <select
                  value={valuationFilter}
                  onChange={(e) => {
                    setValuationFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 pl-2.5 pr-6 text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                  aria-label="Filter by Valuation Status"
                >
                  <option value="ALL">All Valuation</option>
                  <option value="PRICED">PO Priced</option>
                  <option value="UNPRICED">Pending PO</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Sort Dropdown matching /setup/raw-material */}
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
                  <option value="code_asc">Sort: Code (RM-00001 First)</option>
                  <option value="code_desc">Sort: Code (Descending)</option>
                  <option value="name_asc">Sort: Name (A → Z)</option>
                  <option value="name_desc">Sort: Name (Z → A)</option>
                  <option value="category_asc">Sort: Category (A → Z)</option>
                  <option value="quantity_desc">Sort: Qty (High to Low)</option>
                  <option value="quantity_asc">Sort: Qty (Low to High)</option>
                  <option value="rate_desc">Sort: Rate (High to Low)</option>
                  <option value="rate_asc">Sort: Rate (Low to High)</option>
                  <option value="value_with_tax_desc">Sort: Value (With Tax: High to Low)</option>
                  <option value="value_with_tax_asc">Sort: Value (With Tax: Low to High)</option>
                  <option value="value_without_tax_desc">Sort: Value (Excl. Tax: High to Low)</option>
                  <option value="latest">Sort: Latest Added</option>
                  <option value="oldest">Sort: Oldest First</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </span>
              </div>

              {/* Quick Reset Button matching /setup/raw-material */}
              {isFilterActive && (
                <button
                  onClick={handleResetFilters}
                  className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0 cursor-pointer"
                  title="Reset filters and sort"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Compact Table: SN -> Code -> Category -> Name -> Available Qty -> Floating Stock -> Derived Rate -> Stock Valuation -> History */}
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <TableRow className="border-b border-slate-200 dark:border-slate-800">
                  {/* 1. SN */}
                  <TableHead className="py-2 px-2 w-10 text-center">SN</TableHead>

                  {/* 2. Code */}
                  <TableHead className="py-2 px-3 w-28">
                    <button
                      onClick={handleToggleSortCode}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Sort by Code"
                    >
                      <span>Code</span>
                      {sortBy === 'code_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'code_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 3. Category */}
                  <TableHead className="py-2 px-3 w-28">
                    <button
                      onClick={handleToggleSortCategory}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Sort by Category"
                    >
                      <span>Category</span>
                      {sortBy === 'category_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'category_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 4. Name */}
                  <TableHead className="py-2 px-3">
                    <button
                      onClick={handleToggleSortName}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Sort by Name"
                    >
                      <span>Material Name</span>
                      {sortBy === 'name_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'name_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 5. Available Qty */}
                  <TableHead className="py-2 px-3 w-32">
                    <button
                      onClick={handleToggleSortQty}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Sort by Available Quantity"
                    >
                      <span>Available Qty</span>
                      {sortBy === 'quantity_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'quantity_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 6. Floating Stock */}
                  <TableHead className="py-2 px-3 w-28">
                    <button
                      onClick={handleToggleSortFloating}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                      title="Sort by Floating Stock"
                    >
                      <span>Floating Stock</span>
                      {sortBy === 'floating_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'floating_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 7. Derived Rate / Unit */}
                  <TableHead className="py-2 px-3 text-right w-44">
                    <button
                      onClick={handleToggleSortRate}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Derived Rate"
                    >
                      <span>
                        {taxViewMode === 'both' ? 'PO Rate / Unit' : taxViewMode === 'with_tax' ? 'Rate (With Tax)' : 'Rate (Excl. Tax)'}
                      </span>
                      {sortBy === 'rate_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'rate_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 8. Stock Valuation */}
                  <TableHead className="py-2 px-3 text-right w-44">
                    <button
                      onClick={handleToggleSortValue}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none ml-auto"
                      title="Sort by Stock Valuation"
                    >
                      <span>
                        {taxViewMode === 'both' ? 'Valuation (INR)' : taxViewMode === 'with_tax' ? 'Value (With Tax)' : 'Value (Excl. Tax)'}
                      </span>
                      {sortBy === 'value_with_tax_desc' ? (
                        <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : sortBy === 'value_with_tax_asc' ? (
                        <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </TableHead>

                  {/* 9. Action / History */}
                  <TableHead className="py-2 px-2.5 text-center w-20">History</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                      <TableCell className="py-1.5 px-2 text-center"><Skeleton className="h-3.5 w-4 mx-auto rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3"><Skeleton className="h-4 w-16 rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3"><Skeleton className="h-4 w-20 rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3"><Skeleton className="h-4 w-36 rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3"><Skeleton className="h-4 w-16 rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3"><Skeleton className="h-4 w-12 rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3 text-right"><Skeleton className="h-4 w-24 ml-auto rounded" /></TableCell>
                      <TableCell className="py-1.5 px-3 text-right"><Skeleton className="h-4 w-24 ml-auto rounded" /></TableCell>
                      <TableCell className="py-1.5 px-2.5 text-center"><Skeleton className="h-6 w-14 mx-auto rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Package className="w-7 h-7 text-slate-300 dark:text-slate-600 stroke-1" />
                        <p className="font-semibold text-xs text-slate-600 dark:text-slate-300">
                          {searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || valuationFilter !== 'ALL'
                            ? 'No stock found matching your filter criteria.'
                            : 'No raw material inventory recorded.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {isFilterActive
                            ? 'Try clearing or resetting active search and filters.'
                            : 'Purchase Orders and GRN deliveries will populate stock automatically.'}
                        </p>
                        {isFilterActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="mt-1.5 h-7 text-xs"
                          >
                            Reset All Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStock.map((item, idx) => {
                    const calculatedIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                    const isLowStock = Number(item.availableQuantity || 0) <= Number(item.alertLevel || 0);
                    const isSelected = (selectedMaterialId === item.id) || (codeParam && item.code === codeParam);

                    return (
                      <TableRow 
                        key={item.id} 
                        onClick={() => handleOpenHistory(item.id)}
                        className={`transition-colors border-b border-slate-100 dark:border-slate-800/70 last:border-none cursor-pointer group ${
                          isSelected 
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30' 
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        {/* 1. SN */}
                        <TableCell className="py-1.5 px-2 text-center text-slate-400 font-semibold text-[11px]">
                          {calculatedIndex}
                        </TableCell>

                        {/* 2. Code */}
                        <TableCell className="py-1.5 px-3 font-mono text-[11px] font-bold whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] inline-block font-mono border transition-colors ${
                            isSelected
                              ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-black'
                              : 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800 group-hover:border-indigo-300 dark:group-hover:border-indigo-700'
                          }`}>
                            {item.code}
                          </span>
                        </TableCell>

                        {/* 3. Category */}
                        <TableCell className="py-1.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            {item.category || 'Uncategorised'}
                          </span>
                        </TableCell>

                        {/* 4. Name */}
                        <TableCell className="py-1.5 px-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.name}
                          </span>
                        </TableCell>

                        {/* 5. Available Qty */}
                        <TableCell className="py-1.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono font-bold text-xs ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                              {Number(item.availableQuantity || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">{item.unit}</span>
                            {isLowStock && (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" title="Low Stock Alert" />
                            )}
                          </div>
                        </TableCell>

                        {/* 6. Floating Stock */}
                        <TableCell className="py-1.5 px-3 whitespace-nowrap font-mono text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{Number(item.floatingStock || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 uppercase ml-1">{item.unit}</span>
                        </TableCell>

                        {/* 7. Derived Rate Per Unit */}
                        <TableCell className="py-1.5 px-3 text-right whitespace-nowrap">
                          {item.hasPo ? (
                            taxViewMode === 'both' ? (
                              <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-white font-mono text-xs leading-tight">
                                  ₹{Number(item.rateWithTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  <span className="text-[10px] text-slate-400 font-normal ml-1 font-sans">(base ₹{Number(item.rateWithoutTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 leading-tight mt-0.5">
                                  <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                                    {item.gstPercentage || 0}% GST
                                  </span>
                                  {item.poReferenceNo && (
                                    <span className="font-mono text-[9px] text-indigo-600 dark:text-indigo-400 truncate max-w-[100px]" title={`PO: ${item.poReferenceNo}`}>
                                      PO: {item.poReferenceNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : taxViewMode === 'with_tax' ? (
                              <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-white font-mono text-xs leading-tight">
                                  ₹{Number(item.rateWithTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                  Incl. {item.gstPercentage || 0}% GST • <span className="font-mono text-indigo-600 dark:text-indigo-400 font-medium">{item.poReferenceNo}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-white font-mono text-xs leading-tight">
                                  ₹{Number(item.rateWithoutTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                  Base Rate • <span className="font-mono text-indigo-600 dark:text-indigo-400 font-medium">{item.poReferenceNo}</span>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="text-right">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                Pending PO
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* 8. Stock Valuation */}
                        <TableCell className="py-1.5 px-3 text-right whitespace-nowrap">
                          {item.hasPo ? (
                            taxViewMode === 'both' ? (
                              <div className="text-right">
                                <div className="font-black text-slate-900 dark:text-white font-mono text-xs leading-tight">
                                  ₹{Number(item.valueWithTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-tight mt-0.5">
                                  Base: ₹{Number(item.valueWithoutTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • <span className="text-emerald-600 dark:text-emerald-400">+₹{Number(item.taxValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            ) : taxViewMode === 'with_tax' ? (
                              <div className="text-right">
                                <div className="font-black text-slate-900 dark:text-white font-mono text-xs leading-tight">
                                  ₹{Number(item.valueWithTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight mt-0.5">
                                  Incl. ₹{Number(item.taxValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GST
                                </div>
                              </div>
                            ) : (
                              <div className="text-right">
                                <div className="font-black text-slate-900 dark:text-white font-mono text-xs leading-tight">
                                  ₹{Number(item.valueWithoutTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                                  Excl. ₹{Number(item.taxValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GST
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-400 text-xs">₹0.00</span>
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 block leading-tight">
                                Unvalued
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* 9. Action / History */}
                        <TableCell className="py-1.5 px-2.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenHistory(item.id);
                            }}
                            title="View Material Lifecycle & Audit History"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-3xs h-6"
                          >
                            <Clock className="w-3 h-3" />
                            <span>History</span>
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination matching /setup/raw-material */}
          <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div>
              {sortedAndFiltered.length > 0 ? (
                <span>
                  Showing <strong className="text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, sortedAndFiltered.length)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{sortedAndFiltered.length}</strong> materials
                </span>
              ) : (
                <span>0 materials found</span>
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

      {/* RM History Drawer */}
      <RMHistoryDrawer
        materialId={selectedMaterialId}
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        initialTab={drawerInitialTab}
        targetBatch={drawerTargetBatch}
      />
    </div>
  );
}

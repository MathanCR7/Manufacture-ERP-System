import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  Package,
  Search,
  AlertTriangle,
  ArrowRight,
  Layers,
  DollarSign,
  History,
  X,
  Factory,
  ShoppingCart,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  CheckCircle2,
  Boxes,
  Activity,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/Pagination';
import ProductHistoryDrawer from '@/modules/production/components/ProductHistoryDrawer';
import ProductStockQueryModal from '@/modules/production/components/ProductStockQueryModal';

export default function ProductStockPage() {
  const navigate = useNavigate();
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | OPTIMAL | LOW | CRITICAL
  const [sortBy, setSortBy] = useState('code_asc');

  // Modals & Drawers
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [showProductDrawer, setShowProductDrawer] = useState(false);

  // Stock Query Modal State (Tally / ERP Style)
  const [selectedQueryProductId, setSelectedQueryProductId] = useState(null);
  const [showQueryModal, setShowQueryModal] = useState(false);

  // Pagination State for Main Table
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Pagination State for Stock Ledger Modal
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_ITEMS_PER_PAGE = 10;

  // Real-time Auto-Sync via React Query (every 10 seconds, zero stale time, no manual sync button needed)
  const { data: stock = [], isLoading, isFetching } = useQuery({
    queryKey: ['products-stock'],
    queryFn: async () => {
      const res = await api.get('/products/stock');
      return res.data || [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setLedgerPage(1);
    setShowHistoryModal(true);
    try {
      const res = await api.get('/products/stock/movements');
      setMovements(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Distinct category options
  const categoryOptions = useMemo(() => {
    const set = new Set();
    stock.forEach(item => {
      if (item.category && item.category !== 'N/A') set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stock]);

  // Executive inventory metrics
  const { totalValue, totalUnits, lowStockCount, criticalStockCount } = useMemo(() => {
    let val = 0;
    let units = 0;
    let low = 0;
    let crit = 0;

    for (const item of stock) {
      val += Number(item.totalValue || 0);
      units += Number(item.currentStock || 0);
      if (item.status === 'Critical') crit++;
      else if (item.status === 'Low') low++;
    }

    return {
      totalValue: val,
      totalUnits: units,
      lowStockCount: low,
      criticalStockCount: crit
    };
  }, [stock]);

  // Reset pagination when search, filter, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, sortBy]);

  // Comprehensive Filter & Sort matching /rm/stock
  const sortedAndFiltered = useMemo(() => {
    let result = stock.filter(item => {
      // 1. Text Search across name, code, category, unit
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesTerm = (
          (item.name || '').toLowerCase().includes(term) ||
          (item.code || '').toLowerCase().includes(term) ||
          (item.category || '').toLowerCase().includes(term) ||
          (item.unit || '').toLowerCase().includes(term)
        );
        if (!matchesTerm) return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'ALL') {
        if ((item.category || 'Uncategorised') !== categoryFilter) return false;
      }

      // 3. Status Filter
      if (statusFilter === 'OPTIMAL') {
        if (item.status !== 'OK') return false;
      } else if (statusFilter === 'LOW') {
        if (item.status !== 'Low') return false;
      } else if (statusFilter === 'CRITICAL') {
        if (item.status !== 'Critical') return false;
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
        return Number(b.currentStock || 0) - Number(a.currentStock || 0);
      }
      if (sortBy === 'quantity_asc') {
        return Number(a.currentStock || 0) - Number(b.currentStock || 0);
      }
      if (sortBy === 'rate_desc') {
        return Number(b.unitValue || 0) - Number(a.unitValue || 0);
      }
      if (sortBy === 'rate_asc') {
        return Number(a.unitValue || 0) - Number(b.unitValue || 0);
      }
      if (sortBy === 'value_desc') {
        return Number(b.totalValue || 0) - Number(a.totalValue || 0);
      }
      if (sortBy === 'value_asc') {
        return Number(a.totalValue || 0) - Number(b.totalValue || 0);
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
  }, [stock, searchTerm, categoryFilter, statusFilter, sortBy]);

  // Main table pagination
  const totalPages = Math.ceil(sortedAndFiltered.length / ITEMS_PER_PAGE) || 1;
  const paginatedStock = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFiltered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFiltered, currentPage]);

  // Ledger table pagination
  const totalLedgerPages = Math.ceil(movements.length / LEDGER_ITEMS_PER_PAGE) || 1;
  const paginatedLedger = movements.slice(
    (ledgerPage - 1) * LEDGER_ITEMS_PER_PAGE,
    ledgerPage * LEDGER_ITEMS_PER_PAGE
  );

  // Column sort toggles
  const handleToggleSort = (field) => {
    setSortBy(prev => {
      if (field === 'code') return prev === 'code_asc' ? 'code_desc' : 'code_asc';
      if (field === 'name') return prev === 'name_asc' ? 'name_desc' : 'name_asc';
      if (field === 'category') return prev === 'category_asc' ? 'category_desc' : 'category_asc';
      if (field === 'quantity') return prev === 'quantity_desc' ? 'quantity_asc' : 'quantity_desc';
      if (field === 'rate') return prev === 'rate_desc' ? 'rate_asc' : 'rate_desc';
      if (field === 'value') return prev === 'value_desc' ? 'value_asc' : 'value_desc';
      return 'code_asc';
    });
  };

  const getSortIcon = (field) => {
    if (sortBy === `${field}_asc`) return <ArrowUp className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />;
    if (sortBy === `${field}_desc`) return <ArrowDown className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />;
    return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 inline ml-1" />;
  };

  const handleOpenStockQuery = (pId) => {
    setSelectedQueryProductId(pId);
    setShowQueryModal(true);
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
              <Package className="w-5.5 h-5.5 mr-2 text-indigo-600 shrink-0" />
              Finished Product Stock
            </h1>
            {/* Auto-Sync Live Badge (Zero manual sync button) */}
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold font-mono">
              <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isFetching ? 'animate-ping' : ''}`} />
              <span>LIVE AUTO-SYNC</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Real-time finished goods valuation, batch allocation, sales history & BOM formula audit.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/products/stock-adjustment/list')}
            className="flex items-center justify-center gap-1.5 border-slate-200 bg-white dark:bg-slate-900 h-9 text-xs font-bold rounded-xl shadow-2xs cursor-pointer hover:border-indigo-400"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            Stock Adjustment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            className="flex items-center justify-center gap-1.5 border-slate-200 bg-white dark:bg-slate-900 h-9 text-xs font-bold rounded-xl shadow-2xs cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            Stock Ledger
          </Button>
        </div>
      </div>

      {/* Analytics Cards with Click-to-Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'ALL' ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Goods Value</p>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">₹{totalValue.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'ALL' ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Stocked Units</p>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{totalUnits.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(prev => prev === 'LOW' ? 'ALL' : 'LOW')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'LOW' ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Low Stock Products</p>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{lowStockCount}</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(prev => prev === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
          className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            statusFilter === 'CRITICAL' ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Critical Shortfalls</p>
              <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">{criticalStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Sorting Toolbar identical to /rm/stock */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search code, product name, category..." 
            className="pl-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs h-9 rounded-xl focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters & Sorting Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold h-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories ({stock.length})</option>
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold h-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Health Statuses</option>
            <option value="OPTIMAL">🟢 Optimal Stock</option>
            <option value="LOW">🟡 Low Stock</option>
            <option value="CRITICAL">🔴 Critical Shortfall</option>
          </select>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold h-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="code_asc">Code (FP-0001 First)</option>
              <option value="code_desc">Code (Descending)</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="category_asc">Category (A → Z)</option>
              <option value="quantity_desc">Stock Qty (Highest)</option>
              <option value="quantity_asc">Stock Qty (Lowest)</option>
              <option value="value_desc">Valuation (Highest)</option>
              <option value="value_asc">Valuation (Lowest)</option>
              <option value="latest">Recently Created</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest text-[11px]">
              <tr>
                <th className="px-4 py-3 cursor-pointer group" onClick={() => handleToggleSort('code')}>
                  <div className="flex items-center">
                    <span>Product Code</span>
                    {getSortIcon('code')}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer group" onClick={() => handleToggleSort('name')}>
                  <div className="flex items-center">
                    <span>Product Name</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer group" onClick={() => handleToggleSort('category')}>
                  <div className="flex items-center">
                    <span>Category</span>
                    {getSortIcon('category')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right cursor-pointer group" onClick={() => handleToggleSort('quantity')}>
                  <div className="flex items-center justify-end">
                    <span>In Stock</span>
                    {getSortIcon('quantity')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Reorder Pt</th>
                <th className="px-4 py-3 text-right">Min Level</th>
                <th className="px-4 py-3 text-right cursor-pointer group" onClick={() => handleToggleSort('rate')}>
                  <div className="flex items-center justify-end">
                    <span>Unit Price</span>
                    {getSortIcon('rate')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer group" onClick={() => handleToggleSort('value')}>
                  <div className="flex items-center justify-end">
                    <span>Total Value</span>
                    {getSortIcon('value')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Actions & Query</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">Loading finished product inventory...</td>
                </tr>
              ) : paginatedStock.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">No products found matching filters.</td>
                </tr>
              ) : (
                paginatedStock.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => handleOpenStockQuery(item.id)}
                        className="text-left font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        title="Open Stock Query"
                      >
                        {item.code}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => handleOpenStockQuery(item.id)}
                        className="text-left hover:underline cursor-pointer font-bold text-slate-900 dark:text-white"
                        title="Click to view comprehensive Stock Query"
                      >
                        {item.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium text-[10px]">
                        {item.category || 'Finished Goods'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg ${
                        item.status === 'OK'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : item.status === 'Low'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse'
                      }`}>
                        {item.status === 'OK' ? 'Optimal' : item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                      {item.currentStock} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono">
                      {item.reorderPoint}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono">
                      {item.minLevel}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white font-mono">
                      ₹{Number(item.unitValue).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                      ₹{Number(item.totalValue).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Prominent View Button (Stock Query Modal) */}
                        <button
                          type="button"
                          onClick={() => handleOpenStockQuery(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title="Open Tally-style Stock Query (BOM, Sales, Returns, Batches)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {/* History Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForHistory(item);
                            setShowProductDrawer(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                          title={`View audit trail and movements for ${item.name}`}
                        >
                          <History className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ledger</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedAndFiltered.length)} of {sortedAndFiltered.length} products
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Total products: {sortedAndFiltered.length}
            </div>
          </div>
        )}
      </div>

      {/* Stock Ledger History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 text-xs animate__animated animate__zoomIn animate__faster">
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex justify-between items-center relative shadow-sm">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold flex items-center uppercase tracking-wide">
                  <History className="w-5 h-5 mr-2 text-indigo-100" /> Stock Ledger Audit Trail
                </h3>
                <p className="text-[10px] text-indigo-100/90 font-medium">Chronological history of finished product stock movements.</p>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400 font-semibold">Loading audit logs...</div>
              ) : movements.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold">No stock movements recorded yet.</div>
              ) : (
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-950">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/70 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedLedger.map(m => {
                        const isProduction = m.type === 'PRODUCTION_INFLOW';
                        const isSales = m.type === 'SALES_OUTFLOW';
                        
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-semibold">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                              {m.product?.name}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                                m.direction === 1
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}>
                                {isProduction ? (
                                  <Factory className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : isSales ? (
                                  <ShoppingCart className="w-3.5 h-3.5 text-rose-500" />
                                ) : (
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                {m.type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right font-black font-mono text-[13px] ${m.direction === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                              {m.direction === 1 ? '+' : '-'}{m.quantity}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 font-bold">
                              {m.batch?.referenceNo || m.order?.referenceNo || 'System'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">
                              {m.note}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {totalLedgerPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Showing {(ledgerPage - 1) * LEDGER_ITEMS_PER_PAGE + 1} to {Math.min(ledgerPage * LEDGER_ITEMS_PER_PAGE, movements.length)} of {movements.length} entries
                      </div>
                      <Pagination 
                        currentPage={ledgerPage} 
                        totalPages={totalLedgerPages} 
                        onPageChange={setLedgerPage} 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-Product Stock Query Modal (Tally / ERP Full Experience with BOM, Sales, Returns, Batches) */}
      <ProductStockQueryModal
        productId={selectedQueryProductId}
        isOpen={showQueryModal}
        onClose={() => {
          setShowQueryModal(false);
          setSelectedQueryProductId(null);
        }}
        onOpenHistory={(pId) => {
          const match = stock.find(s => s.id === pId);
          if (match) setSelectedProductForHistory(match);
          setShowProductDrawer(true);
        }}
        onSelectProduct={(pId) => setSelectedQueryProductId(pId)}
        allProducts={stock}
      />

      {/* Per-Product Finished Goods History & Stock Ledger Drawer */}
      <ProductHistoryDrawer
        productId={selectedProductForHistory?.id}
        isOpen={showProductDrawer}
        onClose={() => {
          setShowProductDrawer(false);
          setSelectedProductForHistory(null);
        }}
      />
    </div>
  );
}

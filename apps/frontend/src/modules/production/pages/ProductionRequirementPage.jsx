import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/axios';
import {
  Layers, Package, AlertTriangle, ArrowRight, RefreshCw,
  Search, Clock, CheckCircle2, ChevronRight, ExternalLink,
  Calendar, Factory, Sparkles, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, RotateCw, ChevronDown, Flame, ShoppingCart, ShieldCheck,
  Eye, FileText, Check, X, AlertCircle, TrendingDown, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/Pagination';

export default function ProductionRequirementPage() {
  const navigate = useNavigate();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [activeCardFilter, setActiveCardFilter] = useState('ALL'); // ALL, NET_REQUIRED, IN_PRODUCTION, CUSTOMER_SHORTFALL, COVERED

  // Sorting State - default net deficit descending
  const [sortBy, setSortBy] = useState('net_desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Orders Breakdown Modal State
  const [selectedItemForOrders, setSelectedItemForOrders] = useState(null);

  // Fetch live aggregated demand and shortfalls from open customer orders
  const { data: requirements = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['production-requirements'],
    queryFn: async () => {
      const res = await api.get('/orders/production-requirements');
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 30000
  });

  // Extract distinct category options
  const categoryOptions = useMemo(() => {
    const set = new Set();
    requirements.forEach(r => {
      const cat = typeof r.category === 'object' && r.category !== null ? r.category.name : (r.category || '');
      if (cat && cat !== 'ALL') set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [requirements]);

  // Overall KPI Metrics for Interactive Metric Cards
  const metrics = useMemo(() => {
    const totalProducts = requirements.length;
    const totalShortfall = requirements.reduce((s, r) => s + Number(r.totalShortfall || 0), 0);
    const totalInProduction = requirements.reduce((s, r) => s + Number(r.inProduction || 0), 0);
    const totalNetToProduce = requirements.reduce((s, r) => s + Number(r.netToProduce || 0), 0);

    const netCount = requirements.filter(r => Number(r.netToProduce || 0) > 0).length;
    const wipCount = requirements.filter(r => Number(r.inProduction || 0) > 0).length;
    const coveredCount = requirements.filter(r => Number(r.netToProduce || 0) === 0 && Number(r.inProduction || 0) > 0).length;
    
    // Total orders count across all items
    const allOrderIds = new Set();
    requirements.forEach(r => {
      (r.ordersInvolved || []).forEach(o => {
        if (o.orderId) allOrderIds.add(o.orderId);
      });
    });

    return {
      totalProducts,
      totalShortfall,
      totalInProduction,
      totalNetToProduce,
      netCount,
      wipCount,
      coveredCount,
      totalOrdersCount: allOrderIds.size
    };
  }, [requirements]);

  // Handle Card Click Filter Toggle
  const handleCardClick = (filterKey) => {
    if (activeCardFilter === filterKey) {
      setActiveCardFilter('ALL');
    } else {
      setActiveCardFilter(filterKey);
    }
    setCurrentPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setUrgencyFilter('ALL');
    setActiveCardFilter('ALL');
    setSortBy('net_desc');
    setCurrentPage(1);
  };

  // Helper to determine delivery urgency status
  const getDeliveryUrgency = (dateStr) => {
    if (!dateStr) return { status: 'NORMAL', label: 'Standard', color: 'slate' };
    const target = new Date(dateStr);
    const now = new Date();
    // Normalize to midnight
    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'OVERDUE', label: `${Math.abs(diffDays)}d Overdue`, color: 'rose' };
    }
    if (diffDays === 0) {
      return { status: 'TODAY', label: 'Due Today', color: 'amber' };
    }
    if (diffDays === 1) {
      return { status: 'TODAY', label: 'Due Tomorrow', color: 'amber' };
    }
    if (diffDays <= 7) {
      return { status: 'WEEK', label: `In ${diffDays} days`, color: 'indigo' };
    }
    return { status: 'LATER', label: `In ${diffDays} days`, color: 'slate' };
  };

  // Filtered & Sorted Requirements Pipeline
  const filteredAndSorted = useMemo(() => {
    // 1. Filter
    const filtered = requirements.filter(item => {
      // Metric Card Filter
      if (activeCardFilter === 'NET_REQUIRED' && Number(item.netToProduce || 0) <= 0) return false;
      if (activeCardFilter === 'IN_PRODUCTION' && Number(item.inProduction || 0) <= 0) return false;
      if (activeCardFilter === 'CUSTOMER_SHORTFALL' && Number(item.totalShortfall || 0) <= 0) return false;
      if (activeCardFilter === 'COVERED' && !(Number(item.netToProduce || 0) === 0 && Number(item.inProduction || 0) > 0)) return false;

      // Category Filter
      const cat = typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || '');
      if (selectedCategory !== 'ALL' && cat.toLowerCase() !== selectedCategory.toLowerCase()) return false;

      // Urgency Filter
      if (urgencyFilter !== 'ALL') {
        const urgency = getDeliveryUrgency(item.earliestDeliveryDate);
        if (urgencyFilter === 'OVERDUE' && urgency.status !== 'OVERDUE') return false;
        if (urgencyFilter === 'TODAY' && urgency.status !== 'TODAY') return false;
        if (urgencyFilter === 'WEEK' && urgency.status !== 'WEEK' && urgency.status !== 'TODAY') return false;
        if (urgencyFilter === 'LATER' && urgency.status !== 'LATER') return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.productName?.toLowerCase().includes(q);
        const matchCode = item.productCode?.toLowerCase().includes(q);
        const matchCategory = cat.toLowerCase().includes(q);
        const matchOrders = item.ordersInvolved?.some(o => 
          o.docNo?.toLowerCase().includes(q) || 
          o.customerName?.toLowerCase().includes(q)
        );
        if (!matchName && !matchCode && !matchCategory && !matchOrders) return false;
      }

      return true;
    });

    // 2. Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'net_desc':
          return Number(b.netToProduce || 0) - Number(a.netToProduce || 0);
        case 'net_asc':
          return Number(a.netToProduce || 0) - Number(b.netToProduce || 0);
        case 'shortfall_desc':
          return Number(b.totalShortfall || 0) - Number(a.totalShortfall || 0);
        case 'shortfall_asc':
          return Number(a.totalShortfall || 0) - Number(b.totalShortfall || 0);
        case 'wip_desc':
          return Number(b.inProduction || 0) - Number(a.inProduction || 0);
        case 'wip_asc':
          return Number(a.inProduction || 0) - Number(b.inProduction || 0);
        case 'date_asc':
          return new Date(a.earliestDeliveryDate || 0) - new Date(b.earliestDeliveryDate || 0);
        case 'date_desc':
          return new Date(b.earliestDeliveryDate || 0) - new Date(a.earliestDeliveryDate || 0);
        case 'name_asc':
          return (a.productName || '').localeCompare(b.productName || '');
        case 'name_desc':
          return (b.productName || '').localeCompare(a.productName || '');
        case 'category_asc': {
          const catA = typeof a.category === 'object' && a.category ? a.category.name : (a.category || '');
          const catB = typeof b.category === 'object' && b.category ? b.category.name : (b.category || '');
          return catA.localeCompare(catB);
        }
        default:
          return Number(b.netToProduce || 0) - Number(a.netToProduce || 0);
      }
    });
  }, [requirements, activeCardFilter, selectedCategory, urgencyFilter, searchQuery, sortBy]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSorted.slice(start, start + itemsPerPage);
  }, [filteredAndSorted, currentPage, itemsPerPage]);

  return (
    <div className="w-full min-h-screen bg-[#F4F5F8] dark:bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 dark:text-slate-100 flex flex-col">
      
      {/* ── 1) STICKY HEADER (72px, 100% full screen width) ── */}
      <header className="sticky top-0 z-40 h-[72px] w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#E3E6EC] dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/20 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                Production Requirements
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Products Shortfall Hub
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Aggregated customer order deficits & shortage demand driving factory manufacturing
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer shadow-3xs"
            title="Refresh demand deficit"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-indigo-500 ${isRefetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefetching ? 'Syncing...' : 'Sync Demand'}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => navigate('/production/order-based')}
            className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Factory className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Order Production</span>
            <span className="sm:hidden">Orders</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => navigate('/production/standard')}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400 dark:text-amber-600" />
            <span className="hidden sm:inline">Standard Production</span>
            <span className="sm:hidden">Standard</span>
          </Button>
        </div>
      </header>

      {/* ── 2) MAIN CONTENT (100% full screen width, 0 padding container) ── */}
      <main className="w-full flex-1 p-3 sm:p-5 flex flex-col gap-4">

        {/* ── A) INTERACTIVE KPI METRIC CARDS (CLICK TO FILTER) ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
          
          {/* Card 1: All Items with Shortfall */}
          <div
            onClick={() => handleCardClick('ALL')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
              activeCardFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-500" />
                Total Demanded
              </span>
              {activeCardFilter === 'ALL' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500 text-white">Active</span>
              )}
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {metrics.totalProducts}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Across {metrics.totalOrdersCount} open sales orders
            </div>
          </div>

          {/* Card 2: Net Output to Produce (Urgent Gap) */}
          <div
            onClick={() => handleCardClick('NET_REQUIRED')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
              activeCardFilter === 'NET_REQUIRED'
                ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-500 shadow-md ring-2 ring-rose-500/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Net To Produce
              </span>
              {activeCardFilter === 'NET_REQUIRED' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500 text-white">Active</span>
              )}
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {metrics.totalNetToProduce.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-rose-500/80 dark:text-rose-400/80 mt-0.5 truncate font-semibold">
              {metrics.netCount} products requiring batches
            </div>
          </div>

          {/* Card 3: Total Customer Shortfall */}
          <div
            onClick={() => handleCardClick('CUSTOMER_SHORTFALL')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
              activeCardFilter === 'CUSTOMER_SHORTFALL'
                ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-500 shadow-md ring-2 ring-purple-500/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-purple-500" />
                Customer Shortfall
              </span>
              {activeCardFilter === 'CUSTOMER_SHORTFALL' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500 text-white">Active</span>
              )}
            </div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">
              -{metrics.totalShortfall.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-purple-500/80 dark:text-purple-400/80 mt-0.5 truncate font-semibold">
              Total sales order backorders
            </div>
          </div>

          {/* Card 4: In Production (Floor WIP) */}
          <div
            onClick={() => handleCardClick('IN_PRODUCTION')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none ${
              activeCardFilter === 'IN_PRODUCTION'
                ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-500 shadow-md ring-2 ring-amber-500/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-amber-500" />
                Floor WIP Running
              </span>
              {activeCardFilter === 'IN_PRODUCTION' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">Active</span>
              )}
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {metrics.totalInProduction.toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 truncate font-semibold">
              {metrics.wipCount} active batch allocations
            </div>
          </div>

          {/* Card 5: Fully Covered / Pipeline */}
          <div
            onClick={() => handleCardClick('COVERED')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none col-span-2 md:col-span-1 ${
              activeCardFilter === 'COVERED'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Fully Covered
              </span>
              {activeCardFilter === 'COVERED' && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-white">Active</span>
              )}
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.coveredCount}
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 truncate font-semibold">
              WIP covers shortfall completely
            </div>
          </div>

        </div>

        {/* ── B) SEARCH, FILTERS & CONTROLS BAR ── */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-[#E3E6EC] dark:border-slate-800 shadow-xs flex flex-col overflow-hidden">
          
          <div className="p-3 border-b border-[#E3E6EC] dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative w-full lg:w-96 flex items-center">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search product name, code, customer, or SO doc #..."
                className="w-full h-9 pl-9 pr-8 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
              
              {/* Category Filter */}
              <div className="relative flex-1 sm:flex-none min-w-[130px] flex items-center">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-8 pl-2.5 pr-6 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Urgency / Due Date Filter */}
              <div className="relative flex-1 sm:flex-none min-w-[135px] flex items-center">
                <select
                  value={urgencyFilter}
                  onChange={(e) => {
                    setUrgencyFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-8 pl-2.5 pr-6 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="ALL">All Due Dates</option>
                  <option value="OVERDUE">🚨 Overdue Items</option>
                  <option value="TODAY">⚡ Due Today / Tomorrow</option>
                  <option value="WEEK">⏱ Due This Week</option>
                  <option value="LATER">📅 Due Later (&gt; 7d)</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Sort By Dropdown */}
              <div className="relative flex-1 sm:flex-none min-w-[150px] flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-8 pl-2.5 pr-6 text-xs font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer transition-all shadow-3xs hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="net_desc">Net Deficit: High to Low</option>
                  <option value="net_asc">Net Deficit: Low to High</option>
                  <option value="shortfall_desc">Shortfall: High to Low</option>
                  <option value="shortfall_asc">Shortfall: Low to High</option>
                  <option value="date_asc">Delivery Date: Earliest First</option>
                  <option value="date_desc">Delivery Date: Latest First</option>
                  <option value="wip_desc">In Production: High to Low</option>
                  <option value="name_asc">Product Name (A - Z)</option>
                  <option value="name_desc">Product Name (Z - A)</option>
                  <option value="category_asc">Category (A - Z)</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Reset Filters */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Reset
              </Button>

            </div>
          </div>

          {/* Active Filter Indicators */}
          {(activeCardFilter !== 'ALL' || selectedCategory !== 'ALL' || urgencyFilter !== 'ALL' || searchQuery) && (
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="font-bold text-slate-400 uppercase text-[10px] mr-1">Active Filters:</span>
              
              {activeCardFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                  Card: {activeCardFilter.replace('_', ' ')}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setActiveCardFilter('ALL')} />
                </span>
              )}

              {selectedCategory !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                  Category: {selectedCategory}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory('ALL')} />
                </span>
              )}

              {urgencyFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  Urgency: {urgencyFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setUrgencyFilter('ALL')} />
                </span>
              )}

              {searchQuery && (
                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                  Query: "{searchQuery}"
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                </span>
              )}
            </div>
          )}

          {/* ── C) DATA TABLE ── */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  
                  {/* 1. Demanded Product */}
                  <th 
                    onClick={() => setSortBy(s => s === 'name_asc' ? 'name_desc' : 'name_asc')}
                    className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors select-none whitespace-nowrap min-w-[200px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Demanded Product</span>
                      {sortBy === 'name_asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : 
                       sortBy === 'name_desc' ? <ArrowDown className="w-3 h-3 text-indigo-500" /> : 
                       <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>

                  {/* 2. Category */}
                  <th 
                    onClick={() => setSortBy('category_asc')}
                    className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Category</span>
                      {sortBy === 'category_asc' ? <ArrowDown className="w-3 h-3 text-indigo-500" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>

                  {/* 3. Customer Shortfall */}
                  <th 
                    onClick={() => setSortBy(s => s === 'shortfall_desc' ? 'shortfall_asc' : 'shortfall_desc')}
                    className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 text-right cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Customer Shortfall</span>
                      {sortBy === 'shortfall_desc' ? <ArrowDown className="w-3 h-3 text-indigo-500" /> : 
                       sortBy === 'shortfall_asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : 
                       <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>

                  {/* 4. In Production (WIP) */}
                  <th 
                    onClick={() => setSortBy(s => s === 'wip_desc' ? 'wip_asc' : 'wip_desc')}
                    className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 text-right cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Floor WIP (Running)</span>
                      {sortBy === 'wip_desc' ? <ArrowDown className="w-3 h-3 text-indigo-500" /> : 
                       sortBy === 'wip_asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : 
                       <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>

                  {/* 5. Net Output to Produce */}
                  <th 
                    onClick={() => setSortBy(s => s === 'net_desc' ? 'net_asc' : 'net_desc')}
                    className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 text-right cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors select-none whitespace-nowrap min-w-[140px]"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Net To Produce</span>
                      {sortBy === 'net_desc' ? <ArrowDown className="w-3 h-3 text-rose-500" /> : 
                       sortBy === 'net_asc' ? <ArrowUp className="w-3 h-3 text-rose-500" /> : 
                       <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>

                  {/* 6. Earliest Delivery Commitment */}
                  <th 
                    onClick={() => setSortBy(s => s === 'date_asc' ? 'date_desc' : 'date_asc')}
                    className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Earliest Due Date</span>
                      {sortBy === 'date_asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : 
                       sortBy === 'date_desc' ? <ArrowDown className="w-3 h-3 text-indigo-500" /> : 
                       <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>

                  {/* 7. Orders Involved */}
                  <th className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 select-none whitespace-nowrap">
                    Contributing Sales Orders
                  </th>

                  {/* 8. Launch Production Action */}
                  <th className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300 text-right select-none whitespace-nowrap w-[180px] min-w-[180px]">
                    Production Actions
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Aggregating production requirements from customer orders...</span>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-90" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                        {activeCardFilter !== 'ALL' || selectedCategory !== 'ALL' || urgencyFilter !== 'ALL' || searchQuery
                          ? 'No requirements matching active filters'
                          : 'Zero Shortfall Detected!'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        {activeCardFilter !== 'ALL' || selectedCategory !== 'ALL' || urgencyFilter !== 'ALL' || searchQuery
                          ? 'Try resetting the filters or switching card selection to see all items.'
                          : 'All customer sales orders are fully satisfied by available finished stock and active batches.'}
                      </p>
                      {(activeCardFilter !== 'ALL' || selectedCategory !== 'ALL' || urgencyFilter !== 'ALL' || searchQuery) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-3 text-xs font-semibold cursor-pointer"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, idx) => {
                    const urgency = getDeliveryUrgency(item.earliestDeliveryDate);
                    const isNetPositive = Number(item.netToProduce || 0) > 0;
                    const orders = item.ordersInvolved || [];

                    return (
                      <tr 
                        key={item.productId || item.rawMaterialId || idx}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Demanded Product */}
                        <td className="py-2.5 px-3 min-w-[200px]">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              {item.productName || 'Unnamed Product'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>Code: {item.productCode || 'ITEM'}</span>
                              {item.itemType === 'RAW_MATERIAL' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Raw Material
                                </span>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* 2. Category */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            {typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || 'Standard')}
                          </span>
                        </td>

                        {/* 3. Customer Shortfall */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end">
                            <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-xs px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900">
                              -{Number(item.totalShortfall || 0).toLocaleString('en-IN')} {item.unit}
                            </span>
                            <span className="text-[9.5px] text-slate-400 mt-0.5 font-medium">
                              {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                            </span>
                          </div>
                        </td>

                        {/* 4. In Production (WIP) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex flex-col items-end">
                            {Number(item.inProduction || 0) > 0 ? (
                              <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900">
                                {Number(item.inProduction).toLocaleString('en-IN')} {item.unit}
                              </span>
                            ) : (
                              <span className="font-mono text-slate-400 text-xs">0</span>
                            )}
                            {Number(item.totalShortfall || 0) > 0 && Number(item.inProduction || 0) > 0 && (
                              <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                {Math.min(100, Math.round((Number(item.inProduction) / Number(item.totalShortfall)) * 100))}% Covered
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Net Output to Produce */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isNetPositive ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-xs animate-pulse">
                                {Number(item.netToProduce).toLocaleString('en-IN')} {item.unit}
                              </span>
                              <span className="text-[9.5px] font-bold text-rose-500 mt-0.5">
                                Immediate Gap
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-end">
                              <span className="font-bold text-[10.5px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                ✓ Fully Covered
                              </span>
                              <span className="text-[9.5px] text-slate-400 mt-0.5">WIP In Pipeline</span>
                            </div>
                          )}
                        </td>

                        {/* 6. Earliest Delivery Commitment */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.earliestDeliveryDate ? new Date(item.earliestDeliveryDate).toLocaleDateString('en-GB') : 'Immediate'}
                            </span>
                            <span className={`text-[9.5px] font-black uppercase mt-0.5 ${
                              urgency.status === 'OVERDUE'
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : urgency.status === 'TODAY'
                                ? 'text-amber-600 dark:text-amber-400'
                                : urgency.status === 'WEEK'
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-400'
                            }`}>
                              {urgency.label}
                            </span>
                          </div>
                        </td>

                        {/* 7. Contributing Sales Orders */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap max-w-[240px]">
                            {orders.slice(0, 3).map((ord, oIdx) => (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => navigate(`/sales/order?edit=${ord.orderId}&from=/production/requirements`)}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-[10.5px] font-mono font-bold text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300 cursor-pointer transition-colors"
                                title={`${ord.customerName} • Shortfall: -${ord.shortfall} ${item.unit}`}
                              >
                                {ord.docNo}
                              </button>
                            ))}
                            {orders.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setSelectedItemForOrders(item)}
                                className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold hover:underline cursor-pointer"
                              >
                                +{orders.length - 3} more
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 8. Launch Production Action */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Option 1: Order-Based Production */}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const targetQty = item.netToProduce > 0 ? item.netToProduce : item.totalShortfall;
                                const primaryOrderId = orders[0]?.orderId || '';
                                navigate(`/production/order-based/add?orderId=${primaryOrderId}&productId=${item.productId || ''}&quantity=${targetQty}`, {
                                  state: {
                                    productId: item.productId,
                                    orderId: primaryOrderId,
                                    quantity: targetQty
                                  }
                                });
                              }}
                              className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-3xs cursor-pointer inline-flex items-center gap-1 transition-transform active:scale-95"
                              title="Redirect to Order-Based Production with selected order & products"
                            >
                              <Factory className="w-3 h-3" />
                              <span>Order Production</span>
                            </Button>

                            {/* Option 2: Stock Update Production */}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const targetQty = item.netToProduce > 0 ? item.netToProduce : item.totalShortfall;
                                const primaryOrderId = orders[0]?.orderId || '';
                                navigate(`/production/stock-update/add?productId=${item.productId || ''}&quantity=${targetQty}${primaryOrderId ? `&orderId=${primaryOrderId}` : ''}`, {
                                  state: {
                                    productId: item.productId,
                                    orderId: primaryOrderId,
                                    quantity: targetQty
                                  }
                                });
                              }}
                              className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shadow-3xs cursor-pointer inline-flex items-center gap-1 transition-transform active:scale-95"
                              title="Redirect to Stock Update Production with selected product & order items"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>Stock Update</span>
                            </Button>

                            {/* Option 3: Standard Stock Production */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const targetQty = item.netToProduce > 0 ? item.netToProduce : item.totalShortfall;
                                navigate(`/production/standard/add?productId=${item.productId || ''}&quantity=${targetQty}`, {
                                  state: {
                                    productId: item.productId,
                                    quantity: targetQty
                                  }
                                });
                              }}
                              className="h-7 px-2 rounded-lg border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] cursor-pointer"
                              title="Plan Standard batch for finished goods inventory"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                            </Button>

                            {/* Option 4: View Orders Breakdown Modal */}
                            {orders.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedItemForOrders(item)}
                                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="View contributing customer orders breakdown"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            )}

                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── D) PAGINATION BAR ── */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
              Showing <strong className="text-slate-800 dark:text-slate-200">{filteredAndSorted.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredAndSorted.length)}</strong> of <strong className="text-slate-800 dark:text-slate-200">{filteredAndSorted.length}</strong> requirement items
            </div>

            <div className="flex items-center gap-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalRecords={filteredAndSorted.length}
                pageSize={itemsPerPage}
                onPageChange={setCurrentPage}
              />

              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-medium border-l border-slate-200 dark:border-slate-800 pl-3">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-xs font-semibold cursor-pointer outline-none text-slate-700 dark:text-slate-300"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* ── 3) CONTRIBUTING SALES ORDERS BREAKDOWN MODAL ── */}
      {selectedItemForOrders && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-blue-950/20 dark:bg-blue-950/35 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setSelectedItemForOrders(null)}
        >
          <div 
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    Contributing Orders Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {selectedItemForOrders.productName} ({selectedItemForOrders.productCode})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItemForOrders(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              
              {/* Summary Metric Ribbon */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Customer Deficit</div>
                  <div className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                    -{Number(selectedItemForOrders.totalShortfall || 0)} {selectedItemForOrders.unit}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">WIP in Production</div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                    {Number(selectedItemForOrders.inProduction || 0)} {selectedItemForOrders.unit}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Net Gap to Produce</div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {Number(selectedItemForOrders.netToProduce || 0)} {selectedItemForOrders.unit}
                  </div>
                </div>
              </div>

              {/* Contributing Orders Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10.5px] uppercase border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 px-3">Sales Order #</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3 text-right">Shortfall Qty</th>
                      <th className="py-2 px-3">Delivery Commitment</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(selectedItemForOrders.ordersInvolved || []).map((ord, oIdx) => (
                      <tr key={oIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {ord.docNo}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {ord.customerName || 'Walk-in Customer'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          -{ord.shortfall} {selectedItemForOrders.unit}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-400">
                          {ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-GB') : 'Immediate'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                navigate(`/production/order-based/add?orderId=${ord.orderId}&productId=${selectedItemForOrders.productId || ''}&quantity=${ord.shortfall}`, {
                                  state: {
                                    productId: selectedItemForOrders.productId,
                                    orderId: ord.orderId,
                                    quantity: ord.shortfall
                                  }
                                });
                              }}
                              className="h-6 px-2 text-[10.5px] rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                              title="Start Order-Based Production for this customer order"
                            >
                              Order Production
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                navigate(`/production/stock-update/add?productId=${selectedItemForOrders.productId || ''}&quantity=${ord.shortfall}&orderId=${ord.orderId}`, {
                                  state: {
                                    productId: selectedItemForOrders.productId,
                                    orderId: ord.orderId,
                                    quantity: ord.shortfall
                                  }
                                });
                              }}
                              className="h-6 px-2 text-[10.5px] rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
                              title="Start Stock Update replenishment pre-filling this order"
                            >
                              Stock Update
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedItemForOrders(null)}
                className="text-xs font-semibold cursor-pointer"
              >
                Close
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

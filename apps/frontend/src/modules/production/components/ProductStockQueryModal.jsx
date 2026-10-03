import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  X,
  Clock,
  Printer,
  FileSpreadsheet,
  Package,
  Layers,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Building2,
  Tag,
  Boxes,
  Percent,
  Info,
  RotateCcw,
  Factory,
  ShoppingCart
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ProductStockQueryModal({
  productId,
  isOpen,
  onClose,
  onOpenHistory,
  onSelectProduct,
  allProducts = []
}) {
  const [selectedId, setSelectedId] = useState(productId);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState('bom'); // 'bom' | 'returns' | 'batches'

  // Sync selectedId when modal opens or productId changes
  useEffect(() => {
    if (productId) {
      setSelectedId(productId);
    }
  }, [productId, isOpen]);

  // Keyboard shortcuts: Esc to close, H for history, Ctrl+P for print, F4 to search
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if ((e.key === 'h' || e.key === 'H') && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (onOpenHistory && selectedId) {
          onOpenHistory(selectedId);
        }
      } else if ((e.key === 'p' || e.key === 'P') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpenHistory, selectedId, isSearchOpen]);

  // Fetch live full product stock query data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['product-stock-query', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await api.get(`/products/stock/${selectedId}/history`);
      return res.data;
    },
    enabled: !!selectedId && isOpen,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Fetch live company tax & profile details
  const { data: taxSettings } = useQuery({
    queryKey: ['setup-tax-settings'],
    queryFn: async () => {
      const res = await api.get('/setup/tax');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const liveCompanyName = taxSettings?.companyName?.trim() || 'ANTIGRAVITY MANUFACTURING ERP';

  // Dynamic Financial Year (e.g. 2026-2027)
  const financialYear = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }, []);

  const product = data?.product;
  const metrics = data?.metrics;
  const costing = data?.costingSummary;
  const batches = data?.batches || [];
  const orders = data?.orders || [];
  const bom = data?.bom || [];
  const wastages = data?.wastages || [];
  const returns = data?.returns || [];
  const categoryProducts = data?.categoryProducts || [];

  // Currency Formatter
  const formatINR = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Date Formatter
  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      });
    } catch {
      return String(d);
    }
  };

  const baseUom = product?.unit || 'pcs';
  const currentQty = Number(product?.currentStock || 0);

  // Cost & Valuation Calculations
  const costPrice = costing?.avgCostPrice ?? (bom.reduce((s, b) => s + (b.totalCost || 0), 0) || Number(product?.salePrice || 0) * 0.7);
  const standardCost = costing?.standardCost ?? costPrice;
  const sellingPrice = Number(product?.salePrice || 0);
  const closingValue = costing?.closingValue ?? (currentQty * costPrice);

  // Inward List (Production Batches / Completed Receipts)
  const inwardList = useMemo(() => {
    return batches.slice(0, 15);
  }, [batches]);

  // Outward List (Sales Orders, Invoices, POS Outflows)
  const outwardList = useMemo(() => {
    return orders.slice(0, 15);
  }, [orders]);

  // Filtered Products for quick switch search
  const filteredProducts = useMemo(() => {
    if (!itemSearchTerm.trim()) return allProducts.slice(0, 15);
    const q = itemSearchTerm.toLowerCase();
    return allProducts
      .filter((p) => p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allProducts, itemSearchTerm]);

  // Handle Switch to Another Product
  const handleSwitchProduct = (targetId) => {
    setSelectedId(targetId);
    setIsSearchOpen(false);
    setItemSearchTerm('');
    if (onSelectProduct) {
      onSelectProduct(targetId);
    }
  };

  // Export to Excel Multi-Sheet Workbook
  const handleExportExcel = () => {
    if (!product) return;
    const wb = XLSX.utils.book_new();

    // 1. Stock Overview Sheet
    const overviewRows = [
      ['PRODUCT STOCK QUERY OVERVIEW', `${liveCompanyName} ${financialYear}`],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [],
      ['Product Code', product.code],
      ['Product Name', product.name],
      ['Category / Group', product.category],
      ['UOM', baseUom],
      ['Current Stock', `${currentQty} ${baseUom}`],
      ['Closing Value', formatINR(closingValue)],
      ['Average Cost Price (BOM)', formatINR(costPrice)],
      ['Standard Selling Price', formatINR(sellingPrice)],
      ['Reorder Point', `${product.reorderPoint || 0} ${baseUom}`],
      ['Stock Health Status', product.stockHealth],
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Product Overview');

    // 2. Production Inflow
    const inflowRows = [
      ['Date', 'Batch No', 'Planned Qty', 'Actual Output', 'Unit', 'Unit Cost', 'Status'],
      ...batches.map(b => [
        formatDate(b.startDate || b.createdAt),
        b.batchNo,
        b.plannedQuantity,
        b.actualOutput,
        b.unit,
        b.unitCost,
        b.status
      ])
    ];
    const wsInflow = XLSX.utils.aoa_to_sheet(inflowRows);
    XLSX.utils.book_append_sheet(wb, wsInflow, 'Production Inflow');

    // 3. Sales & Issues Outflow
    const salesRows = [
      ['Date', 'Customer Name', 'Order / Ref No', 'Quantity', 'Rate (INR)', 'Subtotal (INR)', 'Status'],
      ...orders.map(o => [
        formatDate(o.orderDate),
        o.customerName,
        o.referenceNo,
        o.orderedQty,
        o.unitPrice,
        o.subtotal,
        o.status
      ])
    ];
    const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
    XLSX.utils.book_append_sheet(wb, wsSales, 'Sales & Outflow');

    // 4. Raw Material Used (BOM)
    const bomRows = [
      ['RM Code', 'Raw Material Name', 'Consumption / Unit', 'RM Unit', 'Unit Price (INR)', 'Total Cost (INR)', 'Current Stock Available'],
      ...bom.map(b => [
        b.rmCode,
        b.rmName,
        b.consumptionPerUnit,
        b.rmUnit,
        b.unitPrice,
        b.totalCost,
        b.currentStock
      ])
    ];
    const wsBOM = XLSX.utils.aoa_to_sheet(bomRows);
    XLSX.utils.book_append_sheet(wb, wsBOM, 'Raw Material Used (BOM)');

    // 5. Customer Sales Returns
    const returnRows = [
      ['Return Date', 'Return Ref No', 'Customer Name', 'Quantity', 'Unit', 'Reason', 'Status'],
      ...returns.map(r => [
        formatDate(r.returnDate),
        r.referenceNo,
        r.customerName,
        r.quantity,
        r.unit,
        r.reason,
        r.status
      ])
    ];
    const wsReturns = XLSX.utils.aoa_to_sheet(returnRows);
    XLSX.utils.book_append_sheet(wb, wsReturns, 'Customer Returns');

    const fileName = `StockQuery_${product.code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  const totalInflowQty = batches.reduce((sum, b) => sum + Number(b.actualOutput || 0), 0);
  const totalInflowAmt = batches.reduce((sum, b) => sum + (Number(b.actualOutput || 0) * Number(b.unitCost || costPrice)), 0);

  const totalOutflowQty = orders.reduce((sum, o) => sum + Number(o.orderedQty || 0), 0);
  const totalOutflowAmt = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);

  const totalReturnsQty = returns.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-1 sm:p-2.5 animate__animated animate__fadeIn animate__faster">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl w-full h-[96vh] max-w-[98vw] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 text-xs transition-colors">
        {/* =========================================================
            TALLY-STYLE HEADER BAR: Title, Search [F4], History [H], Export, Print, Close
        ========================================================= */}
        <header className="bg-slate-900 dark:bg-slate-950 text-white px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 bg-amber-500/20 text-amber-400 rounded">
              <Boxes className="w-4 h-4" />
            </div>
            <span className="font-mono font-black text-xs sm:text-sm tracking-wider uppercase truncate text-amber-300">
              STOCK QUERY
            </span>
            <span className="text-slate-600 font-bold hidden sm:inline">•</span>
            <span className="text-slate-300 dark:text-slate-400 text-xs truncate hidden sm:inline uppercase">
              {liveCompanyName} {financialYear}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Switch Dropdown / Search Button [F4] */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSearchOpen(prev => !prev)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 text-slate-200 transition-colors cursor-pointer"
                title="Switch Product (F4)"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[130px] sm:max-w-[200px]">
                  {product ? `[${product.code}] ${product.name}` : 'Select Product...'}
                </span>
                <span className="bg-slate-950 text-slate-400 px-1 py-0.2 rounded text-[10px] ml-1">F4</span>
              </button>

              {isSearchOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-50 p-2 space-y-1.5 animate__animated animate__fadeIn text-slate-800 dark:text-slate-200">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search code or name..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProducts.length === 0 ? (
                      <div className="p-2 text-center text-slate-400 text-[11px]">No products matched</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSwitchProduct(p.id)}
                          className={`w-full text-left p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-xs cursor-pointer ${
                            p.id === selectedId ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-mono text-amber-600 dark:text-amber-400 mr-1.5 font-bold">[{p.code}]</span>
                            <span>{p.name}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 ml-2">
                            {Number(p.currentStock || 0)} {p.unit || 'pcs'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* History [H] Button */}
            <button
              type="button"
              onClick={() => onOpenHistory && onOpenHistory(selectedId)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
              title="Open Stock Ledger Audit Trail (H)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
              <span className="bg-amber-600/30 text-amber-950 px-1 py-0.2 rounded text-[10px]">H</span>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
              title="Export Stock Query to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
              title="Print Stock Query (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* =========================================================
            MODAL BODY: 2-Column Top Card + 4 Grid Sections
            Seamless support for Light mode (slate-100) and Dark mode (slate-950)
        ========================================================= */}
        <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-slate-100 dark:bg-slate-950">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
              <p className="text-xs font-semibold">Retrieving finished goods stock ledger and BOM...</p>
            </div>
          ) : !product ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Finished Product not found</p>
              <button onClick={() => refetch()} className="mt-2 text-xs text-amber-600 dark:text-amber-400 underline">Retry</button>
            </div>
          ) : (
            <>
              {/* TOP MASTER CARD: 2-Column Split (~120px) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden shrink-0 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                  {/* Left Column */}
                  <div className="p-2 sm:px-3 sm:py-2 space-y-1">
                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Name</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate flex-1 text-left">
                        : {product.name}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Group</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : ♦ {product.category || 'Finished Goods'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold text-[11px] w-28">Closing Balance</span>
                      <div className="flex-1 flex items-baseline justify-between">
                        <span className={`font-mono font-black text-xs sm:text-sm ${currentQty <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          : {currentQty < 0 ? `(-)${Math.abs(currentQty)}` : currentQty} {baseUom}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                          (Val: {formatINR(closingValue)})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Cost price</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : {formatINR(costPrice)} / {baseUom}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Costing method</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex-1 text-left">
                        : Avg. Cost / BOM Formula
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Standard cost</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 flex-1 text-left">
                        : {formatINR(standardCost)} / {baseUom}
                      </span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="p-2 sm:px-3 sm:py-2 space-y-1">
                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Part No.</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-amber-400 flex-1 text-left">
                        : {product.code}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Category</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : ♦ {product.category || 'Finished Products'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/40">
                      <span className="text-blue-800 dark:text-blue-300 font-bold text-[11px] w-36">Closing value</span>
                      <span className="font-mono font-black text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex-1 text-left">
                        : {formatINR(closingValue)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Standard selling price</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : {formatINR(sellingPrice)} / {baseUom}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Market valuation method</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex-1 text-left">
                        : Standard MRP
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium w-36">Reorder & Health</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 flex-1 text-left truncate">
                        : Min: {product.minLevel || 0} • Reorder: {product.reorderPoint || 0} • Status: <strong className="text-emerald-600 dark:text-emerald-400">{product.stockHealth}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MIDDLE SECTION: SPLIT INFLOW (LEFT) VS SALES (RIGHT) */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* ----------------- LEFT: PRODUCTION INFLOW & BATCHES ----------------- */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                  <div className="bg-slate-100 dark:bg-slate-950 px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Factory className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Production Receipts & Inflow
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {batches.length} Batches Logged
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                        <tr>
                          <th className="py-1 px-2 text-left">Date</th>
                          <th className="py-1 px-2 text-left">Batch No</th>
                          <th className="py-1 px-2 text-right">Planned</th>
                          <th className="py-1 px-2 text-right">Output</th>
                          <th className="py-1 px-2 text-right">Unit Cost</th>
                          <th className="py-1 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {inwardList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 italic text-[11px]">
                              No manufacturing runs or production receipts recorded
                            </td>
                          </tr>
                        ) : (
                          inwardList.map((b, idx) => (
                            <tr key={b.id || idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                              <td className="py-1 px-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {formatDate(b.startDate || b.createdAt)}
                              </td>
                              <td className="py-1 px-2 text-slate-900 dark:text-white font-bold whitespace-nowrap">
                                {b.batchNo}
                              </td>
                              <td className="py-1 px-2 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {b.plannedQuantity} {b.unit}
                              </td>
                              <td className="py-1 px-2 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {b.actualOutput} {b.unit}
                              </td>
                              <td className="py-1 px-2 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatINR(b.unitCost || costPrice)}
                              </td>
                              <td className="py-1 px-2 text-center whitespace-nowrap">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  b.status === 'COMPLETED'
                                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] font-mono shrink-0">
                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase">Total Inflow:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {totalInflowQty} {baseUom} • {formatINR(totalInflowAmt)}
                    </span>
                  </div>
                </div>

                {/* ----------------- RIGHT: SALES & ISSUES ----------------- */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                  <div className="bg-slate-100 dark:bg-slate-950 px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Sales & Issues Outflow
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {orders.length} Dispatches
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                        <tr>
                          <th className="py-1 px-2 text-left">Date</th>
                          <th className="py-1 px-2 text-left">Party / Order Ref</th>
                          <th className="py-1 px-2 text-right">Quantity</th>
                          <th className="py-1 px-2 text-right">Rate</th>
                          <th className="py-1 px-2 text-center">Type</th>
                          <th className="py-1 px-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {outwardList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 italic text-[11px]">
                              No sales or order issues recorded yet
                            </td>
                          </tr>
                        ) : (
                          outwardList.map((o, idx) => (
                            <tr key={o.id || idx} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors">
                              <td className="py-1 px-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {formatDate(o.orderDate)}
                              </td>
                              <td className="py-1 px-2 text-slate-900 dark:text-white truncate max-w-[130px]" title={o.customerName}>
                                <div className="font-bold truncate">{o.customerName}</div>
                                <div className="text-[9px] text-slate-400 dark:text-slate-500">{o.referenceNo}</div>
                              </td>
                              <td className="py-1 px-2 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                {o.orderedQty} {o.unit}
                              </td>
                              <td className="py-1 px-2 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatINR(o.unitPrice)}
                              </td>
                              <td className="py-1 px-2 text-center whitespace-nowrap">
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {o.orderType || 'Order'}
                                </span>
                              </td>
                              <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {formatINR(o.subtotal)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] font-mono shrink-0">
                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase">Total Outflow:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {totalOutflowQty} {baseUom} • {formatINR(totalOutflowAmt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOTTOM SECTION: SPLIT SUB-PANEL (LEFT) VS SAME CATEGORY (RIGHT) */}
              <div className="h-44 shrink-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* ----------------- BOTTOM LEFT: TABBED SUB-PANEL (BOM / RETURNS / BATCHES) ----------------- */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                  {/* Tab Selector */}
                  <div className="bg-slate-100 dark:bg-slate-950 px-2 py-1 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBottomTab('bom')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          bottomTab === 'bom'
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        ⚡ Raw Material Used (BOM: {bom.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBottomTab('returns')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          bottomTab === 'returns'
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        ↩ Sales Returns ({returns.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBottomTab('batches')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          bottomTab === 'batches'
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        📦 Batches & QC ({batches.length})
                      </button>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {bottomTab === 'bom' && (
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">RM Code & Name</th>
                            <th className="py-1 px-2 text-right">Consumption/Unit</th>
                            <th className="py-1 px-2 text-right">RM Price</th>
                            <th className="py-1 px-2 text-right">Total RM Cost</th>
                            <th className="py-1 px-2 text-right">RM Stock Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {bom.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No raw material BOM recipe defined for this product
                              </td>
                            </tr>
                          ) : (
                            bom.map((b, idx) => (
                              <tr key={b.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-1 px-2 text-slate-900 dark:text-white">
                                  <span className="font-bold text-amber-600 dark:text-amber-400 mr-1.5">[{b.rmCode}]</span>
                                  <span>{b.rmName}</span>
                                </td>
                                <td className="py-1 px-2 text-right text-slate-700 dark:text-slate-300">
                                  {b.consumptionPerUnit} {b.rmUnit}
                                </td>
                                <td className="py-1 px-2 text-right text-slate-500 dark:text-slate-400">
                                  {formatINR(b.unitPrice)}
                                </td>
                                <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-white">
                                  {formatINR(b.totalCost)}
                                </td>
                                <td className={`py-1 px-2 text-right font-black ${b.currentStock <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {b.currentStock} {b.rmUnit}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {bottomTab === 'returns' && (
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">Date</th>
                            <th className="py-1 px-2 text-left">Return No</th>
                            <th className="py-1 px-2 text-left">Customer</th>
                            <th className="py-1 px-2 text-right">Quantity</th>
                            <th className="py-1 px-2 text-left">Reason</th>
                            <th className="py-1 px-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {returns.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No customer sales returns logged
                              </td>
                            </tr>
                          ) : (
                            returns.map((r, idx) => (
                              <tr key={r.id || idx} className="hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors">
                                <td className="py-1 px-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {formatDate(r.returnDate)}
                                </td>
                                <td className="py-1 px-2 text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                                  {r.referenceNo}
                                </td>
                                <td className="py-1 px-2 text-slate-900 dark:text-white truncate max-w-[120px]">
                                  {r.customerName}
                                </td>
                                <td className="py-1 px-2 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                  +{r.quantity} {r.unit}
                                </td>
                                <td className="py-1 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                                  {r.reason}
                                </td>
                                <td className="py-1 px-2 text-center whitespace-nowrap">
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {bottomTab === 'batches' && (
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">Batch No</th>
                            <th className="py-1 px-2 text-right">Actual Output</th>
                            <th className="py-1 px-2 text-center">QC Status</th>
                            <th className="py-1 px-2 text-right">Unit Cost</th>
                            <th className="py-1 px-2 text-center">Batch Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {batches.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No batches found
                              </td>
                            </tr>
                          ) : (
                            batches.map((b, idx) => (
                              <tr key={b.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-1 px-2 text-slate-900 dark:text-white font-bold">{b.batchNo}</td>
                                <td className="py-1 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{b.actualOutput} {b.unit}</td>
                                <td className="py-1 px-2 text-center">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    b.qcStatus === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                  }`}>
                                    {b.qcStatus}
                                  </span>
                                </td>
                                <td className="py-1 px-2 text-right text-slate-700 dark:text-slate-300">{formatINR(b.unitCost)}</td>
                                <td className="py-1 px-2 text-center text-slate-500 dark:text-slate-400">{b.status}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* ----------------- BOTTOM RIGHT: ITEMS OF SAME CATEGORY ----------------- */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                  <div className="bg-slate-100 dark:bg-slate-950 px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Items of Same Category ({categoryProducts.length} items)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">Click row to switch</span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                        <tr>
                          <th className="py-1 px-2 text-left">Item Name</th>
                          <th className="py-1 px-2 text-right">In Stock</th>
                          <th className="py-1 px-2 text-right">Sale Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {categoryProducts.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-slate-400 italic text-[11px]">
                              No other items in this category
                            </td>
                          </tr>
                        ) : (
                          categoryProducts.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => handleSwitchProduct(item.id)}
                              className="hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                            >
                              <td className="py-1 px-2 text-slate-900 dark:text-white">
                                <span className="font-bold text-amber-600 dark:text-amber-400 mr-1.5">[{item.code}]</span>
                                <span>{item.name}</span>
                              </td>
                              <td className="py-1 px-2 text-right font-bold text-slate-700 dark:text-slate-200">
                                {item.currentStock} {item.unit}
                              </td>
                              <td className="py-1 px-2 text-right font-black text-amber-600 dark:text-amber-300">
                                {formatINR(item.salePrice)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] font-mono shrink-0 text-slate-500 dark:text-slate-400">
                    <span># Click any item to switch view</span>
                    <span>F4 Switch</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

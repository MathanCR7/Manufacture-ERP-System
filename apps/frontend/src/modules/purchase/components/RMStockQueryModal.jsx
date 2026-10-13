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
  ArrowRightLeft,
  Building2,
  Tag,
  Boxes,
  Percent,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function RMStockQueryModal({
  materialId,
  isOpen,
  onClose,
  onOpenHistory,
  onSelectMaterial,
  allMaterials = []
}) {
  const [selectedId, setSelectedId] = useState(materialId);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('all'); // 'all' | 'purchases' | 'sales' | 'batches' | 'same_category'

  // Sync selectedId when modal opens with new materialId
  useEffect(() => {
    if (materialId) {
      setSelectedId(materialId);
    }
  }, [materialId, isOpen]);

  // Keyboard navigation: Esc to close, H for history, Ctrl+P for print
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else {
          onClose();
        }
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

  // Fetch live full stock query data
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rm-stock-query', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await api.get(`/rm-stock/${selectedId}/history`);
      return res.data;
    },
    enabled: !!selectedId && isOpen,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Fetch live company details from /setup/tax
  const { data: taxSettings } = useQuery({
    queryKey: ['setup-tax-settings'],
    queryFn: async () => {
      const res = await api.get('/setup/tax');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const liveCompanyName = taxSettings?.companyName?.trim() || 'COMPANY';

  // Dynamic Financial Year (e.g. 2026-2027)
  const financialYear = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }, []);

  const material = data?.material;
  const summary = data?.summary;
  const costing = data?.costingSummary;
  const purchases = data?.purchases || [];
  const grns = data?.grnReceipts || [];
  const usages = data?.productionUsages || [];
  const batches = data?.batches || [];
  const waste = data?.wasteRecords || [];
  const returns = data?.purchaseReturns || [];
  const categoryItems = data?.categoryItems || [];

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

  // Base and Alternate Unit formatting
  const baseUom = material?.unit || material?.unitId || 'Units';
  const altUom = material?.alternateUom;
  const hasAlt = Boolean(material?.hasAlternateUom && altUom);
  const conversionFactor = Number(material?.conversionFactor || 1);

  const currentQty = Number(material?.currentStock || 0);
  const altQty = hasAlt && conversionFactor > 0 ? (currentQty / conversionFactor).toFixed(2) : null;

  // Cost & Valuation Calculations
  const costPrice = costing?.avgCostPrice ?? Number(material?.ratePerUnit || 0);
  const standardCost = costing?.standardCost ?? Number(material?.masterRate || material?.ratePerUnit || 0);
  const latestPurchaseRate = costing?.latestPurchaseRate ?? (costing?.lastPurchase?.rate || costPrice);
  const closingValue = costing?.closingValue ?? (currentQty * (latestPurchaseRate || costPrice));

  // Inward purchases list
  const inwardList = useMemo(() => {
    return purchases.slice(0, 15);
  }, [purchases]);

  // Outward list (Production Issues, Wastage, Returns)
  const outwardList = useMemo(() => {
    const list = [];
    usages.forEach((u) => {
      list.push({
        id: `usage-${u.id}`,
        date: u.date,
        party: `${u.batchNumber || 'Batch'} • ${u.productOnlyName || u.productName || 'Production'}`,
        qty: Number(u.actualUsedQty || 0),
        rate: Number(u.unitCost || 0),
        amount: Number(u.totalCost || 0),
        type: 'Issue',
      });
    });
    waste.forEach((w) => {
      list.push({
        id: `waste-${w.id}`,
        date: w.date,
        party: `Wastage (${w.referenceNo || 'Loss'})`,
        qty: Number(w.quantity || 0),
        rate: w.quantity > 0 ? Number(w.lossAmount || 0) / Number(w.quantity) : 0,
        amount: Number(w.lossAmount || 0),
        type: 'Waste',
      });
    });
    returns.forEach((r) => {
      list.push({
        id: `return-${r.id}`,
        date: r.returnDate,
        party: `Return to ${r.supplierName || 'Supplier'}`,
        qty: Number(r.returnQty || 0),
        rate: costPrice,
        amount: Number(r.returnQty || 0) * costPrice,
        type: 'Return',
      });
    });
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    return list.slice(0, 15);
  }, [usages, waste, returns, costPrice]);

  // Godown / Batches list
  const godownList = useMemo(() => {
    if (batches.length > 0) {
      return batches.slice(0, 12);
    }
    if (currentQty !== 0) {
      return [
        {
          id: 'main-loc',
          storageLocation: 'Main Location',
          batchNumber: 'Primary Batch',
          netQty: currentQty,
          uom: baseUom,
          status: 'ACTIVE',
        },
      ];
    }
    return [];
  }, [batches, currentQty, baseUom]);

  // Last Purchase Header Banner
  const lastPurchase = costing?.lastPurchase || (purchases[0] ? {
    date: purchases[0].orderDate,
    partyName: purchases[0].supplierName,
    quantity: purchases[0].orderedQty,
    uom: purchases[0].uom || baseUom,
    rate: purchases[0].unitPriceWithGst || purchases[0].unitPrice,
    amount: purchases[0].itemTotal,
  } : null);

  // Last Outward Header Banner
  const lastIssue = costing?.lastIssue || (outwardList[0] ? {
    date: outwardList[0].date,
    partyName: outwardList[0].party,
    quantity: outwardList[0].qty,
    uom: baseUom,
    rate: outwardList[0].rate,
    amount: outwardList[0].amount,
  } : null);

  // Filtered materials for switch search
  const filteredMaterials = useMemo(() => {
    if (!itemSearchTerm.trim()) return allMaterials.slice(0, 15);
    const q = itemSearchTerm.toLowerCase();
    return allMaterials
      .filter((m) => m.name?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allMaterials, itemSearchTerm]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (!material) return;
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ['MATERIAL STOCK QUERY OVERVIEW', `${liveCompanyName} ${financialYear}`],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [],
      ['Item Code', material.code],
      ['Item Name', material.name],
      ['Print Name', material.printName || material.name],
      ['Category', material.category],
      ['Base UOM', baseUom],
      ['Alternate UOM', hasAlt ? `${material.alternateUom} (1 ${material.alternateUom} = ${conversionFactor} ${baseUom})` : 'None'],
      ['Consumption Unit', material.consumptionUnit || '—'],
      ['HSN Code', material.hsnCode || '—'],
      ['Opening Stock', `${material.openingStock || 0} ${baseUom}`],
      ['Closing Balance', `${currentQty} ${baseUom}`],
      ['Alternate Balance', hasAlt ? `${altQty} ${altUom}` : '—'],
      ['Closing Value', formatINR(closingValue)],
      ['Avg. Cost Price', formatINR(costPrice)],
      ['Valuation Rate', formatINR(latestPurchaseRate)],
      ['Standard Master Rate', formatINR(standardCost)],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Stock Overview');

    const purchaseRows = [
      ['Date', 'Party Name / Supplier', 'PO Reference', 'Quantity', 'UOM', 'Rate (INR)', 'GST %', 'Total Amount (INR)'],
      ...purchases.map((p) => [
        formatDate(p.orderDate),
        p.supplierName,
        p.referenceNo,
        p.orderedQty,
        p.uom,
        p.unitPriceWithGst || p.unitPrice,
        p.gstPercentage || 0,
        p.itemTotal,
      ]),
    ];
    const wsPurchases = XLSX.utils.aoa_to_sheet(purchaseRows);
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases (Inward)');

    const outwardRows = [
      ['Date', 'Particulars / Batch', 'Type', 'Quantity', 'Rate (INR)', 'Total Amount (INR)'],
      ...outwardList.map((o) => [
        formatDate(o.date),
        o.party,
        o.type,
        o.qty,
        o.rate,
        o.amount,
      ]),
    ];
    const wsOutward = XLSX.utils.aoa_to_sheet(outwardRows);
    XLSX.utils.book_append_sheet(wb, wsOutward, 'Outward (Consumption)');

    const godownRows = [
      ['Godown / Location', 'Batch Number', 'Net Qty', 'UOM', 'Expiry Date', 'Status'],
      ...batches.map((b) => [
        b.storageLocation || 'Main RM Godown',
        b.batchNumber,
        b.netQty,
        b.uom,
        formatDate(b.expiryDate),
        b.status,
      ]),
    ];
    const wsGodown = XLSX.utils.aoa_to_sheet(godownRows);
    XLSX.utils.book_append_sheet(wb, wsGodown, 'Godown Details');

    XLSX.writeFile(wb, `Stock_Query_${material?.code || 'item'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-slate-950/75 backdrop-blur-xs select-none overflow-hidden">
      <div 
        className="w-full h-full flex flex-col bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* =========================================================
            TOP NAVIGATION BAR (Responsive on Mobile, Fixed Single-Row on Desktop)
        ========================================================= */}
        <header className="bg-slate-900 border-b border-slate-800 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 min-h-10 shadow-xs z-30">
          {/* Left Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white whitespace-nowrap">
                Stock Query
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden md:inline truncate">
                • <strong className="text-amber-300 uppercase tracking-tight">{liveCompanyName} {financialYear}</strong>
              </span>
            </div>
          </div>

          {/* Center: Quick Item Switcher */}
          <div className="relative flex-1 sm:flex-none max-w-[200px] sm:max-w-xs mx-1">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="w-full inline-flex items-center justify-between sm:justify-start gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded border border-slate-700 transition-all cursor-pointer shadow-3xs hover:border-indigo-500"
              title="Switch Stock Item (F4)"
            >
              <div className="flex items-center gap-1 truncate min-w-0">
                <Search className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="font-mono text-indigo-300 font-bold text-[9px] sm:text-[10px] shrink-0">
                  [{material?.code || 'Select'}]
                </span>
                <span className="truncate text-left">{material?.name || 'Switch Item'}</span>
              </div>
              <kbd className="hidden lg:inline text-[9px] bg-slate-700 text-slate-300 px-1 rounded font-mono shrink-0 ml-1">F4</kbd>
            </button>

            {/* Dropdown Modal / Popover: Centered on mobile with backdrop */}
            {isSearchOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-2xs sm:hidden"
                  onClick={() => setIsSearchOpen(false)} 
                />
                <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-12 sm:top-full mt-1.5 w-auto sm:w-96 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl sm:rounded-lg shadow-2xl z-50 p-2.5 text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800 sm:hidden">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Select Stock Material</span>
                    <button 
                      type="button"
                      onClick={() => setIsSearchOpen(false)} 
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 mb-2 shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search code or name..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      autoFocus
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-white outline-none placeholder:text-slate-400"
                    />
                    {itemSearchTerm && (
                      <button onClick={() => setItemSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-60 sm:max-h-52 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredMaterials.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(m.id);
                          if (onSelectMaterial) onSelectMaterial(m.id);
                          setIsSearchOpen(false);
                          setItemSearchTerm('');
                        }}
                        className={`w-full text-left px-2.5 py-2 sm:py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded flex items-center justify-between transition-colors ${
                          m.id === selectedId ? 'bg-indigo-50/90 dark:bg-indigo-950 font-bold text-indigo-600 dark:text-indigo-400' : ''
                        }`}
                      >
                        <div className="truncate mr-2 min-w-0">
                          <span className="font-mono text-[10px] text-slate-400 mr-1.5">[{m.code}]</span>
                          <span className="truncate">{m.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {m.availableQuantity ?? m.currentStock ?? 0} {m.unit || ''}
                        </span>
                      </button>
                    ))}
                    {filteredMaterials.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">No matching materials found</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* History Button (Opens existing RMHistoryDrawer seamlessly) */}
            <button
              type="button"
              onClick={() => {
                if (onOpenHistory && selectedId) {
                  onOpenHistory(selectedId);
                }
              }}
              title="View Complete Audit History (Press H)"
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow-3xs cursor-pointer transition-all border border-amber-400 hover:shadow-xs"
            >
              <Clock className="w-3 h-3" />
              <span className="hidden xs:inline">History</span>
              <kbd className="hidden lg:inline text-[9px] bg-amber-600/30 text-amber-950 px-1 rounded font-mono font-normal">H</kbd>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              title="Export Stock Query to Excel (.xlsx)"
              className="inline-flex items-center gap-1 p-1 sm:px-2 sm:py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-3xs cursor-pointer transition-all border border-emerald-500"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => window.print()}
              title="Print Stock Query (Ctrl+P)"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded shadow-3xs cursor-pointer transition-all border border-slate-700"
            >
              <Printer className="w-3 h-3" />
              <span className="hidden md:inline">Print</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* =========================================================
            MODAL BODY: Responsive Scroll on Mobile (<lg), Single-Screen Fixed on Desktop (>=lg)
        ========================================================= */}
        <div className="flex-1 flex flex-col p-2 sm:p-2.5 gap-2 overflow-y-auto lg:overflow-hidden bg-slate-100 dark:bg-slate-950">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Fetching live stock details...</p>
            </div>
          ) : !material ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 py-12">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Material not found</p>
              <button onClick={() => refetch()} className="mt-2 text-xs text-indigo-600 underline cursor-pointer">Retry</button>
            </div>
          ) : (
            <>
              {/* =========================================================
                  MOBILE-OPTIMIZED MASTER INFO CARD (< md)
              ========================================================= */}
              <div className="md:hidden bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-3 shadow-3xs space-y-2.5 text-xs shrink-0">
                {/* Header: Code + Category + HSN */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800">
                    {material.code}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                    ♦ {material.category || 'Primary'}
                  </span>
                  {material.hsnCode && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-850 text-slate-500 border border-slate-200 dark:border-slate-700">
                      HSN: {material.hsnCode}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {material.name}
                  </h2>
                  {material.printName && material.printName !== material.name && (
                    <p className="text-[10px] text-slate-400 italic mt-0.5">({material.printName})</p>
                  )}
                </div>

                {/* 2-Column Primary Metric Cards */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Closing Balance */}
                  <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-800 dark:text-emerald-400 block">
                      Closing Balance
                    </span>
                    <div className="mt-0.5">
                      <span className={`font-mono font-black text-sm block ${currentQty <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {currentQty < 0 ? `(-)${Math.abs(currentQty)}` : currentQty} {baseUom}
                      </span>
                      {hasAlt && altQty && (
                        <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                          = {altQty} {altUom}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Closing Value */}
                  <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-blue-800 dark:text-blue-400 block">
                      Closing Value
                    </span>
                    <div className="mt-0.5">
                      <span className="font-mono font-black text-sm text-blue-900 dark:text-blue-200 block">
                        {formatINR(closingValue)}
                      </span>
                      <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium block mt-0.5">
                        Avg. Cost Valuation
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rates Breakdown Subgrid */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Cost Price:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatINR(costPrice)} <span className="text-[9px] font-normal text-slate-400">/{baseUom}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Std Selling Price:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatINR(latestPurchaseRate)} <span className="text-[9px] font-normal text-slate-400">/{baseUom}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Standard Cost:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatINR(standardCost)} <span className="text-[9px] font-normal text-slate-400">/{baseUom}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Costing Method:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Avg. Cost</span>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  DESKTOP MASTER INFORMATION BOX (>= md: Exact Original Layout)
              ========================================================= */}
              <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden shrink-0 text-xs">
                <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
                  {/* Left Column */}
                  <div className="p-2 sm:px-3 sm:py-2 space-y-1">
                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Name</span>
                      <span className="font-bold text-slate-900 dark:text-white truncate flex-1 text-left">
                        : {material.name}
                        {material.printName && material.printName !== material.name && (
                          <span className="text-slate-400 font-normal italic ml-1">({material.printName})</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-28">Group</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : ♦ {material.category || 'Primary'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight bg-emerald-50/70 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold text-[11px] w-28">Closing Balance</span>
                      <div className="flex-1 flex items-baseline justify-between">
                        <span className={`font-mono font-black text-xs sm:text-sm ${currentQty <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          : {currentQty < 0 ? `(-)${Math.abs(currentQty)}` : currentQty} {baseUom}
                        </span>
                        {hasAlt && altQty && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                            (= {altQty} {altUom})
                          </span>
                        )}
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
                        : Avg. Cost
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
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex-1 text-left">
                        : {material.code}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Category</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : ♦ {material.category || 'Not Applicable'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight bg-blue-50/70 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/40">
                      <span className="text-blue-800 dark:text-blue-300 font-bold text-[11px] w-36">Closing value</span>
                      <span className="font-mono font-black text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex-1 text-left">
                        : {formatINR(closingValue)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Standard selling price</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 text-left">
                        : {formatINR(latestPurchaseRate)} / {baseUom}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium w-36">Market valuation method</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex-1 text-left">
                        : Avg. Price
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between leading-tight text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium w-36">HSN & Formula</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 flex-1 text-left truncate">
                        : HSN {material.hsnCode || 'N/A'} {hasAlt ? `• 1 ${material.alternateUom} = ${conversionFactor} ${baseUom}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  MOBILE SECTION SWITCHER PILLS (< lg)
              ========================================================= */}
              <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 shrink-0 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeMobileTab === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  All Sections
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('purchases')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeMobileTab === 'purchases'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Purchases ({inwardList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('sales')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeMobileTab === 'sales'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Sales & Issues ({outwardList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('batches')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeMobileTab === 'batches'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Batches ({godownList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('same_category')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeMobileTab === 'same_category'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Related ({categoryItems.length})
                </button>
              </div>

              {/* =========================================================
                  MOBILE RESPONSIVE CARDS VIEW (< lg, NO HORIZONTAL SCROLL)
              ========================================================= */}
              <div className="lg:hidden flex flex-col gap-2.5">
                {/* 1. Mobile Purchases */}
                {(activeMobileTab === 'all' || activeMobileTab === 'purchases') && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-3xs overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-850 px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Purchases (Inflow)
                      </span>
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 font-mono font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800">
                        Total: {summary?.totalPurchasedQty || 0} {baseUom}
                      </span>
                    </div>

                    {inwardList.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic text-xs">
                        No purchases recorded for this item
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {inwardList.map((p, idx) => (
                          <div key={p.id || idx} className="p-3 space-y-1.5 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                {p.supplierName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                                {formatDate(p.orderDate)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">
                                  {p.orderedQty} {p.uom || baseUom}
                                </span>
                                <span className="text-[10px] text-slate-400">@</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                  ₹{Number(p.unitPriceWithGst || p.unitPrice || 0).toFixed(2)}
                                </span>
                                {p.gstPercentage > 0 && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                    {p.gstPercentage}% GST
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                                {formatINR(p.itemTotal)}
                              </span>
                            </div>

                            {p.referenceNo && (
                              <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                                PO Ref: {p.referenceNo}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total Footer */}
                    <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Total Inflow Value:</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {formatINR(summary?.totalPurchasedValue || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Mobile Sales & Issues */}
                {(activeMobileTab === 'all' || activeMobileTab === 'sales') && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-3xs overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-850 px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Sales & Issues (Outflow)
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-800">
                        Total: {summary?.totalConsumedQty || 0} {baseUom}
                      </span>
                    </div>

                    {outwardList.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic text-xs">
                        No sales or production issues logged
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {outwardList.map((o, idx) => (
                          <div key={o.id || idx} className="p-3 space-y-1.5 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                                {o.party}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                o.type === 'Issue' 
                                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' 
                                  : o.type === 'Waste'
                                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                              }`}>
                                {o.type}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                                  {o.qty} {baseUom}
                                </span>
                                <span className="text-[10px] text-slate-400">@</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                  ₹{Number(o.rate || 0).toFixed(2)}
                                </span>
                              </div>
                              <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                                {formatINR(o.amount)}
                              </span>
                            </div>

                            <div className="text-[10px] font-mono text-slate-400">
                              Date: {formatDate(o.date)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total Footer */}
                    <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Total Outflow Cost:</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {formatINR(summary?.totalConsumedCost || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Mobile Godown / Batch Details */}
                {(activeMobileTab === 'all' || activeMobileTab === 'batches') && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-3xs overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-850 px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Warehouse className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Godown / Batch Details
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-bold">
                        {godownList.length} locations
                      </span>
                    </div>

                    {godownList.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic text-xs">
                        No batch records logged
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {godownList.map((g, idx) => {
                          const gQty = Number(g.netQty ?? g.quantity ?? 0);
                          const gVal = gQty * costPrice;
                          return (
                            <div key={g.id || idx} className="p-3 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  {g.storageLocation || 'Main Location'}
                                </span>
                                <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                                  {gQty < 0 ? `(-)${Math.abs(gQty)}` : gQty} {g.uom || baseUom}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                                  {g.batchNumber || 'Primary Batch'}
                                  {g.expiryDate && (
                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 ml-1">
                                      (Exp: {formatDate(g.expiryDate)})
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                                  {formatINR(gVal)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Total Footer */}
                    <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-slate-500 uppercase text-[10px]">Total Balance:</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {currentQty < 0 ? `(-)${Math.abs(currentQty)}` : currentQty} {baseUom}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Mobile Items of Same Category */}
                {(activeMobileTab === 'all' || activeMobileTab === 'same_category') && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-3xs overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-850 px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Items of Same Category
                      </span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                        {categoryItems.length} items
                      </span>
                    </div>

                    {categoryItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 italic text-xs">
                        No other items in this category
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {categoryItems.map((ci) => (
                          <div
                            key={ci.id}
                            onClick={() => {
                              setSelectedId(ci.id);
                              if (onSelectMaterial) onSelectMaterial(ci.id);
                            }}
                            className="p-3 flex items-center justify-between gap-2 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 cursor-pointer transition-colors active:bg-indigo-100"
                            title="Tap to switch Stock Query to this item"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[9px] text-slate-400">[{ci.code}]</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                                  {ci.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Tap to view stock
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                                {ci.quantity} {ci.uom}
                              </div>
                              <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                {formatINR(ci.totalValue)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total Footer */}
                    <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Sparkles className="w-2.5 h-2.5" /> Tap any item to inspect
                      </span>
                      <span className="font-mono font-bold">{categoryItems.length} related</span>
                    </div>
                  </div>
                )}
              </div>

              {/* =========================================================
                  DESKTOP VIEW (>= lg: 100% Intact Fixed Single-Screen 2x2 Grid)
              ========================================================= */}
              <div className="hidden lg:flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
                {/* MIDDLE SECTION: SPLIT PURCHASES (LEFT) VS SALES (RIGHT) */}
                <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
                  {/* LEFT: PURCHASES */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                    <div className="bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 border-b border-slate-300 dark:border-slate-700 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          Purchases
                        </span>
                        {lastPurchase ? (
                          <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate max-w-[280px]">
                            <span>Last: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatDate(lastPurchase.date)}</strong></span>
                            <span className="truncate font-semibold text-indigo-600 dark:text-indigo-400" title={lastPurchase.partyName}>{lastPurchase.partyName}</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{lastPurchase.quantity} {lastPurchase.uom} @ {formatINR(lastPurchase.rate)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No purchase history</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">Date</th>
                            <th className="py-1 px-2 text-left">Party Name</th>
                            <th className="py-1 px-2 text-right">Quantity</th>
                            <th className="py-1 px-2 text-right">Rate</th>
                            <th className="py-1 px-2 text-right">Disc/Amt</th>
                            <th className="py-1 px-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                          {inwardList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No purchases recorded
                              </td>
                            </tr>
                          ) : (
                            inwardList.map((p, idx) => (
                              <tr key={p.id || idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors">
                                <td className="py-1 px-2 font-mono text-slate-500 whitespace-nowrap">
                                  {formatDate(p.orderDate)}
                                </td>
                                <td className="py-1 px-2 max-w-[130px] truncate" title={p.supplierName}>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{p.supplierName}</span>
                                  <span className="text-[9px] text-slate-400 font-mono ml-1">({p.referenceNo})</span>
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                  {p.orderedQty} {p.uom || baseUom}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {Number(p.unitPriceWithGst || p.unitPrice || 0).toFixed(2)}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-slate-500 whitespace-nowrap">
                                  {p.gstPercentage ? `${p.gstPercentage}%` : '0%'}
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {formatINR(p.itemTotal)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono shrink-0">
                      <span className="font-bold text-slate-500 uppercase">Total Inflow:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {summary?.totalPurchasedQty || 0} {baseUom}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {formatINR(summary?.totalPurchasedValue || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: SALES & CONSUMPTION */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                    <div className="bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 border-b border-slate-300 dark:border-slate-700 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Sales & Issues
                        </span>
                        {lastIssue ? (
                          <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate max-w-[280px]">
                            <span>Last: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatDate(lastIssue.date)}</strong></span>
                            <span className="truncate font-semibold text-amber-700 dark:text-amber-400" title={lastIssue.partyName}>{lastIssue.partyName}</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{lastIssue.quantity} {lastIssue.uom} @ {formatINR(lastIssue.rate)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No consumption recorded</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">Date</th>
                            <th className="py-1 px-2 text-left">Party / Job Name</th>
                            <th className="py-1 px-2 text-right">Quantity</th>
                            <th className="py-1 px-2 text-right">Rate</th>
                            <th className="py-1 px-2 text-right">Type</th>
                            <th className="py-1 px-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                          {outwardList.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No sales or production issues logged
                              </td>
                            </tr>
                          ) : (
                            outwardList.map((o, idx) => (
                              <tr key={o.id || idx} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors">
                                <td className="py-1 px-2 font-mono text-slate-500 whitespace-nowrap">
                                  {formatDate(o.date)}
                                </td>
                                <td className="py-1 px-2 max-w-[130px] truncate" title={o.party}>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{o.party}</span>
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                  {o.qty} {baseUom}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {Number(o.rate || 0).toFixed(2)}
                                </td>
                                <td className="py-1 px-2 text-right whitespace-nowrap">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                    o.type === 'Issue' 
                                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' 
                                      : o.type === 'Waste'
                                      ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                      : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                                  }`}>
                                    {o.type}
                                  </span>
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {formatINR(o.amount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono shrink-0">
                      <span className="font-bold text-slate-500 uppercase">Total Outflow:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {summary?.totalConsumedQty || 0} {baseUom}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {formatINR(summary?.totalConsumedCost || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM SECTION: GODOWN DETAILS (LEFT) VS SAME CATEGORY (RIGHT) */}
                <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
                  {/* LEFT: GODOWN / BATCH DETAILS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                    <div className="bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between shrink-0">
                      <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                        <Warehouse className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Godown / Batch Details
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {godownList.length} locations
                      </span>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">Godown</th>
                            <th className="py-1 px-2 text-left">Batch</th>
                            <th className="py-1 px-2 text-right">Quantity</th>
                            <th className="py-1 px-2 text-right">Value (INR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                          {godownList.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No batch records logged
                              </td>
                            </tr>
                          ) : (
                            godownList.map((g, idx) => {
                              const gQty = Number(g.netQty ?? g.quantity ?? 0);
                              const gVal = gQty * costPrice;
                              return (
                                <tr key={g.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="py-1 px-2 font-semibold text-slate-800 dark:text-slate-200">
                                    {g.storageLocation || 'Main Location'}
                                  </td>
                                  <td className="py-1 px-2 font-mono text-slate-600 dark:text-slate-300">
                                    {g.batchNumber || 'Primary Batch'}
                                    {g.expiryDate && (
                                      <span className="text-[9px] text-amber-600 dark:text-amber-400 ml-1">
                                        (Exp: {formatDate(g.expiryDate)})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {gQty < 0 ? `(-)${Math.abs(gQty)}` : gQty} {g.uom || baseUom}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                    {formatINR(gVal)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono shrink-0">
                      <span className="font-bold text-slate-500 uppercase">Total:</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {currentQty < 0 ? `(-)${Math.abs(currentQty)}` : currentQty} {baseUom}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: ITEMS OF SAME CATEGORY */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                    <div className="bg-slate-100 dark:bg-slate-800/90 px-2.5 py-1 border-b border-slate-300 dark:border-slate-700 flex items-center justify-between shrink-0">
                      <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                        <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        Items of Same Category
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {categoryItems.length} items
                      </span>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase sticky top-0 backdrop-blur-xs">
                          <tr>
                            <th className="py-1 px-2 text-left">Item Name</th>
                            <th className="py-1 px-2 text-right">Quantity</th>
                            <th className="py-1 px-2 text-right">Cost</th>
                            <th className="py-1 px-2 text-right">Sale Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                          {categoryItems.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400 italic text-[11px]">
                                No other items in this category
                              </td>
                            </tr>
                          ) : (
                            categoryItems.map((ci) => (
                              <tr
                                key={ci.id}
                                onClick={() => {
                                  setSelectedId(ci.id);
                                  if (onSelectMaterial) onSelectMaterial(ci.id);
                                }}
                                className="hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 cursor-pointer transition-colors group"
                                title="Click to switch Stock Query to this item"
                              >
                                <td className="py-1 px-2 max-w-[140px] truncate">
                                  <span className="font-mono text-[9px] text-slate-400 mr-1">[{ci.code}]</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                    {ci.name}
                                  </span>
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                  {ci.quantity} {ci.uom}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {Number(ci.cost || 0).toFixed(2)}
                                </td>
                                <td className="py-1 px-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {formatINR(ci.totalValue)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                      <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Sparkles className="w-2.5 h-2.5" /> Click any item to switch view
                      </span>
                      <span className="font-mono">F4 Switch</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* =========================================================
            BOTTOM COMMAND & SHORTCUT FOOTER (Compact: ~28px)
        ========================================================= */}
        <footer className="bg-slate-900 border-t border-slate-800 text-slate-300 px-3 sm:px-4 py-1 flex items-center justify-between text-[10px] sm:text-[11px] font-mono shrink-0 h-7 select-none">
          <div className="flex items-center gap-2.5 sm:gap-5">
            <span className="flex items-center gap-1 hover:text-white cursor-pointer" onClick={onClose}>
              <strong className="text-amber-300 font-bold">Esc:</strong> Close
            </span>
            <span 
              className="flex items-center gap-1 hover:text-white cursor-pointer" 
              onClick={() => onOpenHistory && onOpenHistory(selectedId)}
            >
              <strong className="text-amber-300 font-bold">H:</strong> <span className="hidden xs:inline">Full</span> History
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <strong className="text-amber-300 font-bold">F4:</strong> Switch
            </span>
            <span className="hidden md:flex items-center gap-1">
              <strong className="text-amber-300 font-bold">Ctrl+P:</strong> Print
            </span>
          </div>

          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              Synced • <strong className="font-mono text-amber-300">{material?.code || selectedId}</strong>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

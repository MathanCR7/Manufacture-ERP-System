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
        onClose();
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
  }, [isOpen, onClose, onOpenHistory, selectedId]);

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
            TOP NAVIGATION BAR (Compact Single-Screen Header: ~42px)
        ========================================================= */}
        <header className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-4 py-2 flex items-center justify-between shrink-0 h-10 shadow-xs">
          {/* Left Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">Stock Query</span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                • <strong className="text-amber-300 uppercase tracking-tight">{liveCompanyName} {financialYear}</strong>
              </span>
            </div>
          </div>

          {/* Quick Item Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded border border-slate-700 transition-all cursor-pointer shadow-3xs hover:border-indigo-500"
              title="Switch Stock Item (F4)"
            >
              <Search className="w-3 h-3 text-indigo-400" />
              <span className="font-mono text-indigo-300 font-bold">[{material?.code || 'Select'}]</span>
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{material?.name || 'Switch Item'}</span>
              <kbd className="hidden md:inline text-[9px] bg-slate-700 text-slate-300 px-1 rounded font-mono">F4</kbd>
            </button>

            {isSearchOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xl z-50 p-2 text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 mb-2">
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
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
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
                      className={`w-full text-left px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded flex items-center justify-between transition-colors ${
                        m.id === selectedId ? 'bg-indigo-50/90 dark:bg-indigo-950 font-bold text-indigo-600 dark:text-indigo-400' : ''
                      }`}
                    >
                      <div className="truncate mr-2">
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">[{m.code}]</span>
                        <span>{m.name}</span>
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
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* History Button (Opens existing RMHistoryDrawer seamlessly) */}
            <button
              type="button"
              onClick={() => {
                if (onOpenHistory && selectedId) {
                  onOpenHistory(selectedId);
                }
              }}
              title="View Complete Audit History (Press H)"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow-3xs cursor-pointer transition-all border border-amber-400 hover:shadow-xs"
            >
              <Clock className="w-3 h-3" />
              <span>History</span>
              <kbd className="hidden lg:inline text-[9px] bg-amber-600/30 text-amber-950 px-1 rounded font-mono font-normal">H</kbd>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              title="Export Stock Query to Excel (.xlsx)"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-3xs cursor-pointer transition-all border border-emerald-500"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => window.print()}
              title="Print Stock Query (Ctrl+P)"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded shadow-3xs cursor-pointer transition-all border border-slate-700"
            >
              <Printer className="w-3 h-3" />
              <span className="hidden md:inline">Print</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* =========================================================
            SINGLE-SCREEN BODY (flex-1 overflow-hidden, NO PAGE SCROLL)
        ========================================================= */}
        <div className="flex-1 flex flex-col p-2 sm:p-2.5 gap-2 overflow-hidden bg-slate-100 dark:bg-slate-950">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Fetching live stock details...</p>
            </div>
          ) : !material ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Material not found</p>
              <button onClick={() => refetch()} className="mt-2 text-xs text-indigo-600 underline">Retry</button>
            </div>
          ) : (
            <>
              {/* =========================================================
                  TOP MASTER INFORMATION BOX (Compact 2-Column Split: ~125px)
              ========================================================= */}
              <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden shrink-0 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
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
                  MIDDLE SECTION: SPLIT PURCHASES (LEFT) VS SALES (RIGHT)
                  (Takes ~52% of remaining height, scrollable within each table)
              ========================================================= */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* ----------------- LEFT: PURCHASES ----------------- */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                  {/* Header Banner */}
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

                  {/* Purchases Table (Scrollable within container) */}
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

                  {/* Purchases Footer Total */}
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

                {/* ----------------- RIGHT: SALES & CONSUMPTION ----------------- */}
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-3xs overflow-hidden flex flex-col min-h-0">
                  {/* Header Banner */}
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

                  {/* Outward Table (Scrollable within container) */}
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

                  {/* Outward Footer Total */}
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

              {/* =========================================================
                  BOTTOM SECTION: GODOWN DETAILS (LEFT) VS SAME CATEGORY (RIGHT)
                  (Takes ~48% of remaining height, scrollable within each table)
              ========================================================= */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* ----------------- LEFT: GODOWN / BATCH DETAILS ----------------- */}
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

                  {/* Godown Table (Scrollable within container) */}
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

                  {/* Godown Total */}
                  <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono shrink-0">
                    <span className="font-bold text-slate-500 uppercase">Total:</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {currentQty < 0 ? `(-)${Math.abs(currentQty)}` : currentQty} {baseUom}
                    </span>
                  </div>
                </div>

                {/* ----------------- RIGHT: ITEMS OF SAME CATEGORY ----------------- */}
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

                  {/* Same Category Table (Scrollable within container) */}
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

                  {/* Same Category Footer */}
                  <div className="bg-slate-50 dark:bg-slate-950 px-2.5 py-0.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                      <Sparkles className="w-2.5 h-2.5" /> Click any item to switch view
                    </span>
                    <span className="font-mono">F4 Switch</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* =========================================================
            BOTTOM COMMAND & SHORTCUT FOOTER (Compact: ~28px)
        ========================================================= */}
        <footer className="bg-slate-900 border-t border-slate-800 text-slate-300 px-3 sm:px-4 py-1 flex items-center justify-between text-[11px] font-mono shrink-0 h-7 select-none">
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="flex items-center gap-1 hover:text-white cursor-pointer" onClick={onClose}>
              <strong className="text-amber-300 font-bold">Esc:</strong> Close
            </span>
            <span 
              className="flex items-center gap-1 hover:text-white cursor-pointer" 
              onClick={() => onOpenHistory && onOpenHistory(selectedId)}
            >
              <strong className="text-amber-300 font-bold">H:</strong> Full History
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <strong className="text-amber-300 font-bold">F4:</strong> Switch Item
            </span>
            <span className="hidden md:flex items-center gap-1">
              <strong className="text-amber-300 font-bold">Ctrl+P:</strong> Print
            </span>
          </div>

          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Synced • <strong className="font-mono text-amber-300">{material?.code || selectedId}</strong></span>
          </div>
        </footer>
      </div>
    </div>
  );
}

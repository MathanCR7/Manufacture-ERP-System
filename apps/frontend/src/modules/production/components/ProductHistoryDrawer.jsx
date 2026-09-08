import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import * as XLSX from 'xlsx';
import {
  X,
  Clock,
  Calendar,
  ShoppingCart,
  Factory,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Package,
  Layers,
  FileText,
  CheckCircle2,
  XCircle,
  Maximize2,
  Minimize2,
  Trash2,
  User,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  DollarSign,
  TrendingUp,
  Activity,
  Sliders,
  RotateCcw,
  Boxes,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProductHistoryDrawer({ productId, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('ledger');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['product-history', productId],
    queryFn: async () => {
      const res = await api.get(`/products/stock/${productId}/history`);
      return res.data;
    },
    enabled: !!productId && isOpen,
    staleTime: 1000 * 30, // 30s cache
  });

  if (!isOpen) return null;

  const product = data?.product || {};
  const metrics = data?.metrics || {};
  const ledger = data?.ledger || [];
  const batches = data?.batches || [];
  const orders = data?.orders || [];
  const bom = data?.bom || [];
  const wastages = data?.wastages || [];
  const returns = data?.returns || [];
  const timeline = data?.timeline || [];

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Export to Excel Multi-Sheet Workbook
  const handleExportExcel = () => {
    if (!data) return;

    const workbook = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
      { Parameter: 'Product Code', Value: product.code },
      { Parameter: 'Product Name', Value: product.name },
      { Parameter: 'Category', Value: product.category },
      { Parameter: 'Unit of Measure', Value: product.unit },
      { Parameter: 'Sale Price (INR)', Value: product.salePrice },
      { Parameter: 'Current On-Hand Stock', Value: `${product.currentStock} ${product.unit}` },
      { Parameter: 'Stock Valuation (INR)', Value: product.totalValue },
      { Parameter: 'Stock Health Status', Value: product.stockHealth },
      { Parameter: 'Min Stock Level', Value: product.minLevel },
      { Parameter: 'Reorder Point', Value: product.reorderPoint },
      { Parameter: 'Max Capacity', Value: product.maxLevel },
      { Parameter: 'Total Lifetime Produced In', Value: `${metrics.totalProducedIn} ${product.unit}` },
      { Parameter: 'Total Lifetime Allocated Out', Value: `${metrics.totalAllocatedOut} ${product.unit}` },
      { Parameter: 'Total Wasted/Lost', Value: `${metrics.totalWasted} ${product.unit}` },
      { Parameter: 'Report Generated At', Value: new Date().toLocaleString() }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Product Overview');

    // 2. Stock Ledger Audit Trail Sheet
    const ledgerData = ledger.length > 0 ? ledger.map(l => ({
      'Date & Time': formatDate(l.createdAt),
      'Movement Type': l.type?.replace(/_/g, ' ').toUpperCase(),
      'Direction': l.direction === 1 ? 'INFLOW (+)' : 'OUTFLOW (-)',
      'Quantity': l.quantity,
      'Unit': product.unit,
      'Stock Balance After': l.balanceAfter,
      'Reference Code': l.referenceNo,
      'Batch Number': l.batchNo || 'N/A',
      'Order Reference': l.orderNo || 'N/A',
      'Remarks / Operational Notes': l.note || 'None',
      'Authorized User': l.actorName,
      'User Role': l.actorRole
    })) : [{ Note: 'No stock movements recorded yet.' }];
    const ledgerSheet = XLSX.utils.json_to_sheet(ledgerData);
    XLSX.utils.book_append_sheet(workbook, ledgerSheet, 'Stock Ledger Audit');

    // 3. Production Inflows Sheet
    const batchesData = batches.length > 0 ? batches.map(b => ({
      'Batch Number': b.batchNo,
      'Planned Qty': b.plannedQuantity,
      'Actual Output': b.actualOutput,
      'Yield (%)': b.yieldPercent,
      'Unit': product.unit,
      'Unit Cost (INR)': b.unitCost,
      'Total Batch Cost (INR)': b.totalCost,
      'QC Decision': b.qcStatus,
      'QC Inspector': b.qcTester,
      'Production Status': b.status,
      'Start Date': formatShortDate(b.startDate),
      'Completion Date': formatShortDate(b.endDate)
    })) : [{ Note: 'No production batches recorded for this product.' }];
    const batchesSheet = XLSX.utils.json_to_sheet(batchesData);
    XLSX.utils.book_append_sheet(workbook, batchesSheet, 'Production Batches');

    // 4. Customer Orders Sheet
    const ordersData = orders.length > 0 ? orders.map(o => ({
      'Order Reference': o.referenceNo,
      'Customer Name': o.customerName,
      'Customer Contact': o.customerContact,
      'Order Date': formatShortDate(o.orderDate),
      'Delivery Date': formatShortDate(o.deliveryDate),
      'Ordered Quantity': o.orderedQty,
      'Unit Rate (INR)': o.unitPrice,
      'Line Total (INR)': o.subtotal,
      'Order Status': o.status
    })) : [{ Note: 'No customer orders recorded for this product.' }];
    const ordersSheet = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Customer Orders');

    // 5. Bill of Materials Sheet
    const bomData = bom.length > 0 ? bom.map(bm => ({
      'Raw Material Code': bm.rmCode,
      'Raw Material Name': bm.rmName,
      'Consumption Per Piece': bm.consumptionPerUnit,
      'RM Base Unit': bm.rmUnit,
      'Current In-Stock RM': bm.currentStock,
      'RM Unit Rate (INR)': bm.unitPrice,
      'Line Total Cost (INR)': bm.totalCost
    })) : [{ Note: 'No BoM recipe defined for this product.' }];
    const bomSheet = XLSX.utils.json_to_sheet(bomData);
    XLSX.utils.book_append_sheet(workbook, bomSheet, 'BoM Ingredients');

    // 6. Wastage & Loss Sheet
    if (wastages.length > 0) {
      const wasteData = wastages.map(w => ({
        'Waste Reference': w.referenceNo,
        'Date': formatShortDate(w.date),
        'Quantity Wasted': w.quantity,
        'Unit': w.unit,
        'Loss Value (INR)': w.lossAmount,
        'Reason / Notes': w.note,
        'Recorded By': w.createdBy
      }));
      const wasteSheet = XLSX.utils.json_to_sheet(wasteData);
      XLSX.utils.book_append_sheet(workbook, wasteSheet, 'Product Wastage');
    }

    // Trigger download
    const fileName = `${product.code || 'Product'}_Stock_Ledger_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300">
      <div
        className={`bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full border-l border-slate-200 dark:border-slate-800 transition-all duration-300 ${
          isFullscreen ? 'w-full' : 'w-full md:w-5/6 lg:w-4/5 xl:w-3/4 2xl:w-2/3'
        }`}
      >
        {/* TOP HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-950/40">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                    {product.code || 'PROD'}
                  </span>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    {product.name || 'Finished Product'}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {product.category}
                  </span>
                  {product.stockHealth && (
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        product.stockHealth === 'OPTIMAL'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : product.stockHealth === 'LOW'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse'
                      }`}
                    >
                      ● {product.stockHealth}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Finished Goods Inventory & Comprehensive Stock Ledger Audit Trail
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isLoading || !data}
                className="h-8 text-xs font-bold gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-pointer"
                title="Export complete history & audit trail to Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </Button>

              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh history data"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 5 KEY METRIC CARDS */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 mt-4 text-xs">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <span>Current Stock</span>
                  <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  {product.currentStock?.toLocaleString()} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Opening: {product.openingStock} {product.unit}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <span>Total Goods Value</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(product.totalValue)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Rate: {formatCurrency(product.salePrice)} / {product.unit}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <span>Total Produced In</span>
                  <Factory className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  +{metrics.totalProducedIn?.toLocaleString()} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Across {batches.length} production batches
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <span>Total Allocated Out</span>
                  <ShoppingCart className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                  -{metrics.totalAllocatedOut?.toLocaleString()} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Across {orders.length} customer orders
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <span>Stock Thresholds</span>
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex justify-between">
                  <span>Min: <strong>{product.minLevel}</strong></span>
                  <span>Reorder: <strong>{product.reorderPoint}</strong></span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Max: {product.maxLevel > 0 ? product.maxLevel : 'Unlimited'}
                </div>
              </div>
            </div>
          )}

          {/* TABS NAVIGATION */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-4 mt-2 border-t border-slate-200/60 dark:border-slate-800 no-scrollbar">
            {[
              { id: 'ledger', label: 'Stock Ledger', icon: Activity, count: ledger.length },
              { id: 'batches', label: 'Production Batches', icon: Factory, count: batches.length },
              { id: 'orders', label: 'Customer Orders', icon: ShoppingCart, count: orders.length },
              { id: 'timeline', label: 'Unified Timeline', icon: Clock, count: timeline.length },
              { id: 'bom', label: 'BoM Ingredients', icon: Layers, count: bom.length },
              { id: 'waste', label: 'Wastage & Returns', icon: AlertTriangle, count: wastages.length + returns.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-300 dark:shadow-indigo-950'
                      : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* DRAWER BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading finished product history and stock ledger...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3 bg-rose-50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900">
              <XCircle className="w-8 h-8 mx-auto text-rose-500" />
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to load product history</h3>
              <p className="text-xs text-rose-700 dark:text-rose-300">{error.message || 'An unexpected error occurred'}</p>
              <Button size="sm" onClick={() => refetch()} className="text-xs font-bold">Try Again</Button>
            </div>
          ) : (
            <>
              {/* 1. STOCK LEDGER AUDIT TRAIL TAB */}
              {activeTab === 'ledger' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Stock Ledger Audit Trail ({ledger.length})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Chronological running balance ledger tracking every finished goods movement with interconnected references.
                      </p>
                    </div>
                  </div>

                  {ledger.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                      No stock movements recorded for this product yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Date & Time</th>
                            <th className="p-3">Product</th>
                            <th className="p-3">Type</th>
                            <th className="p-3 text-right">Quantity</th>
                            <th className="p-3 text-right">Running Balance</th>
                            <th className="p-3">Reference</th>
                            <th className="p-3">Remarks / Notes</th>
                            <th className="p-3">Logged By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {ledger.map((entry) => {
                            const isAdd = entry.direction === 1;
                            const isProd = entry.type === 'production_in';
                            const isOrder = entry.type === 'order_allocation';

                            return (
                              <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {formatDate(entry.createdAt)}
                                </td>
                                <td className="p-3 font-bold text-slate-900 dark:text-white">
                                  {product.name}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg border ${
                                      isAdd
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    }`}
                                  >
                                    {isProd ? (
                                      <Factory className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    ) : isOrder ? (
                                      <ShoppingCart className="w-3 h-3 text-rose-500" />
                                    ) : isAdd ? (
                                      <ArrowUpRight className="w-3 h-3" />
                                    ) : (
                                      <ArrowDownRight className="w-3 h-3" />
                                    )}
                                    {entry.type?.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td
                                  className={`p-3 text-right font-mono font-black text-sm whitespace-nowrap ${
                                    isAdd ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isAdd ? `+${entry.quantity}` : `-${entry.quantity}`}
                                </td>
                                <td className="p-3 text-right font-mono font-black text-sm text-slate-900 dark:text-white whitespace-nowrap bg-slate-50/50 dark:bg-slate-950/50">
                                  {entry.balanceAfter} <span className="text-[10px] font-normal text-slate-400">{product.unit}</span>
                                </td>
                                <td className="p-3 font-mono font-bold whitespace-nowrap">
                                  {entry.batchId || entry.batchNo ? (
                                    <button
                                      type="button"
                                      onClick={() => window.open(`/production/batches?id=${entry.batchId || ''}&from=product_stock`, '_blank')}
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                      title="Open Production Batch in new tab"
                                    >
                                      <span>{entry.batchNo || entry.referenceNo}</span>
                                      <ArrowUpRight className="w-3 h-3 opacity-70" />
                                    </button>
                                  ) : entry.orderId || entry.orderNo ? (
                                    <button
                                      type="button"
                                      onClick={() => window.open(`/sales/orders?search=${encodeURIComponent(entry.orderNo || '')}`, '_blank')}
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                      title="Open Customer Order in new tab"
                                    >
                                      <span>{entry.orderNo || entry.referenceNo}</span>
                                      <ArrowUpRight className="w-3 h-3 opacity-70" />
                                    </button>
                                  ) : (
                                    <span className="text-slate-600 dark:text-slate-400">{entry.referenceNo}</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={entry.note}>
                                  {entry.note || 'None'}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{entry.actorName}</span>
                                  <span className="text-[10px] text-slate-400 block">{entry.actorRole}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 2. PRODUCTION INFLOW BATCHES TAB */}
              {activeTab === 'batches' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Production Batches ({batches.length})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        All manufacturing output batches that produced this finished product.
                      </p>
                    </div>
                  </div>

                  {batches.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                      No manufacturing batches logged for this product yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Batch Number</th>
                            <th className="p-3 text-right">Planned Qty</th>
                            <th className="p-3 text-right">Actual Output</th>
                            <th className="p-3 text-right">Yield %</th>
                            <th className="p-3 text-right">Unit Cost</th>
                            <th className="p-3 text-right">Total Batch Cost</th>
                            <th className="p-3 text-center">QC Status</th>
                            <th className="p-3 text-center">Batch Status</th>
                            <th className="p-3">Completion Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {batches.map((batch) => (
                            <tr key={batch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors font-medium">
                              <td className="p-3 font-mono font-bold">
                                <button
                                  type="button"
                                  onClick={() => window.open(`/production/batches?id=${batch.id}&from=product_stock`, '_blank')}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                  title="Open Production Batch in new tab"
                                >
                                  <span>{batch.batchNo}</span>
                                  <ArrowUpRight className="w-3 h-3 opacity-70" />
                                </button>
                              </td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {batch.plannedQuantity} {batch.unit}
                              </td>
                              <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                +{batch.actualOutput} {batch.unit}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {batch.yieldPercent}%
                              </td>
                              <td className="p-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatCurrency(batch.unitCost)}
                              </td>
                              <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(batch.totalCost)}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    batch.qcStatus === 'APPROVED'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                                      : batch.qcStatus === 'REJECTED'
                                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                  }`}
                                >
                                  {batch.qcStatus}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                  {batch.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono text-[11px]">
                                {formatShortDate(batch.endDate || batch.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. CUSTOMER SALES ORDERS TAB */}
              {activeTab === 'orders' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Customer Sales Orders ({orders.length})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Customer orders allocating, reserving, or dispatching this finished product.
                      </p>
                    </div>
                  </div>

                  {orders.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                      No customer orders have requested this product yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Order Ref</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Order Date</th>
                            <th className="p-3">Delivery Date</th>
                            <th className="p-3 text-right">Ordered Qty</th>
                            <th className="p-3 text-right">Unit Rate</th>
                            <th className="p-3 text-right">Item Total</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {orders.map((ord) => (
                            <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-3 font-mono font-bold">
                                <button
                                  type="button"
                                  onClick={() => window.open(`/sales/orders?search=${encodeURIComponent(ord.referenceNo)}`, '_blank')}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                  title="Open Customer Order in new tab"
                                >
                                  <span>{ord.referenceNo}</span>
                                  <ArrowUpRight className="w-3 h-3 opacity-70" />
                                </button>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">{ord.customerName}</div>
                                {ord.customerContact && (
                                  <div className="text-[10px] text-slate-400">{ord.customerContact}</div>
                                )}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {formatShortDate(ord.orderDate)}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {formatShortDate(ord.deliveryDate)}
                              </td>
                              <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                -{ord.orderedQty} {ord.unit}
                              </td>
                              <td className="p-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatCurrency(ord.unitPrice)}
                              </td>
                              <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(ord.subtotal)}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900">
                                  {ord.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 4. UNIFIED CHRONOLOGICAL TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Product Lifecycle Timeline ({timeline.length})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Unified chronological timeline of production releases, order allocations, and inventory actions.
                      </p>
                    </div>
                  </div>

                  {timeline.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                      No chronological events logged for this product.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {timeline.map((event) => {
                        const isProd = event.type === 'PRODUCTION_INFLOW';
                        const isSales = event.type === 'SALES_ALLOCATION';

                        return (
                          <div key={event.id} className="relative group">
                            <div
                              className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                isProd
                                  ? 'bg-emerald-500'
                                  : isSales
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-500'
                              }`}
                            />
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {event.title}
                                  </span>
                                  <span className="text-[9px] font-bold px-2 py-0.2 rounded-full uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {event.status}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatDate(event.timestamp)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                {event.subtitle}
                              </p>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                                {event.metadata?.batchId ? (
                                  <button
                                    type="button"
                                    onClick={() => window.open(`/production/batches?id=${event.metadata.batchId}&from=product_stock`, '_blank')}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                  >
                                    <span>Open Batch ({event.metadata.referenceNo})</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-70" />
                                  </button>
                                ) : event.metadata?.orderId ? (
                                  <button
                                    type="button"
                                    onClick={() => window.open(`/sales/orders?search=${encodeURIComponent(event.metadata.referenceNo || '')}`, '_blank')}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-bold"
                                  >
                                    <span>Open Order ({event.metadata.referenceNo})</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-70" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400">Ref: {event.metadata?.referenceNo}</span>
                                )}

                                {event.user && (
                                  <span className="text-slate-400">
                                    Logged by: <strong className="text-slate-600 dark:text-slate-300">{event.user}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 5. BILL OF MATERIALS (BOM INGREDIENTS) TAB */}
              {activeTab === 'bom' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Ingredients & Bill of Materials ({bom.length})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Raw materials required per 1 {product.unit} with current inventory availability.
                      </p>
                    </div>
                  </div>

                  {bom.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                      No Bill of Materials configured for this product.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3">Raw Material</th>
                            <th className="p-3 text-right">Qty Per Unit</th>
                            <th className="p-3 text-right">Available RM Stock</th>
                            <th className="p-3 text-right">RM Unit Price</th>
                            <th className="p-3 text-right">Total RM Cost</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {bom.map((ing) => (
                            <tr key={ing.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                <div className="font-bold">{ing.rmName}</div>
                                <span className="text-[10px] font-mono text-slate-400">{ing.rmCode}</span>
                              </td>
                              <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                {ing.consumptionPerUnit} {ing.rmUnit}
                              </td>
                              <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                {ing.currentStock} {ing.rmUnit}
                              </td>
                              <td className="p-3 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {formatCurrency(ing.unitPrice)} / {ing.rmUnit}
                              </td>
                              <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(ing.totalCost)}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => window.open(`/rm/stock?search=${encodeURIComponent(ing.rmName)}`, '_blank')}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-bold cursor-pointer"
                                  title="View Raw Material Stock in new tab"
                                >
                                  <span>View RM</span>
                                  <ArrowUpRight className="w-3 h-3 opacity-70" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 6. WASTAGE & RETURNS TAB */}
              {activeTab === 'waste' && (
                <div className="space-y-4">
                  {/* Wastage */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Product Wastage Records ({wastages.length})
                    </h3>
                    {wastages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                        No product wastage or damage recorded for this product.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="p-3">Reference</th>
                              <th className="p-3">Date</th>
                              <th className="p-3 text-right">Wasted Qty</th>
                              <th className="p-3 text-right">Estimated Loss</th>
                              <th className="p-3">Reason / Notes</th>
                              <th className="p-3">Recorded By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {wastages.map((w) => (
                              <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                                  {w.referenceNo}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {formatShortDate(w.date)}
                                </td>
                                <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                  -{w.quantity} {w.unit}
                                </td>
                                <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {formatCurrency(w.lossAmount)}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300">
                                  {w.note}
                                </td>
                                <td className="p-3 text-slate-700 dark:text-slate-300">
                                  {w.createdBy}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Customer Returns */}
                  <div className="space-y-2 pt-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Customer Sales Returns ({returns.length})
                    </h3>
                    {returns.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                        No customer returns recorded for this product.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="p-3">Return Ref</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Customer</th>
                              <th className="p-3 text-right">Returned Qty</th>
                              <th className="p-3">Reason</th>
                              <th className="p-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {returns.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {r.referenceNo}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                  {formatShortDate(r.returnDate)}
                                </td>
                                <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                  {r.customerName}
                                </td>
                                <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  +{r.quantity} {r.unit}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300">
                                  {r.reason}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900">
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

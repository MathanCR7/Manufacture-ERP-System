import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import * as XLSX from 'xlsx';
import {
  X,
  Clock,
  Calendar,
  ShoppingCart,
  Truck,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Package,
  Layers,
  FileText,
  CheckCircle2,
  XCircle,
  Maximize2,
  Minimize2,
  Trash2,
  Cpu,
  User,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  Warehouse,
  IndianRupee,
  RotateCcw,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RMHistoryDrawer({ materialId, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch full history from backend
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['rm-history', materialId],
    queryFn: async () => {
      if (!materialId) return null;
      const res = await api.get(`/rm-stock/${materialId}/history`);
      return res.data;
    },
    enabled: !!materialId && isOpen,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  if (!isOpen) return null;

  const material = data?.material;
  const summary = data?.summary;
  const timeline = data?.timeline || [];
  const purchases = data?.purchases || [];
  const grnReceipts = data?.grnReceipts || [];
  const batches = data?.batches || [];
  const labReports = data?.labReports || [];
  const stockAdjustments = data?.stockAdjustments || [];
  const wasteRecords = data?.wasteRecords || [];
  const productionUsages = data?.productionUsages || [];
  const purchaseReturns = data?.purchaseReturns || [];

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(d);
    }
  };

  const formatShortDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(d);
    }
  };

  const formatCurrency = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleExportExcel = () => {
    if (!material) return;

    const workbook = XLSX.utils.book_new();

    // 1. Overview Sheet
    const overviewData = [
      { Field: 'Material Name', Value: material.name },
      { Field: 'Material Code', Value: material.code },
      { Field: 'Category', Value: material.category },
      { Field: 'Unit of Measure', Value: material.unit },
      { Field: 'Standard Rate Per Unit (INR)', Value: Number(material.ratePerUnit || 0) },
      { Field: 'Current Available Stock', Value: Number(material.currentStock || 0) },
      { Field: 'Current Stock Valuation (INR)', Value: Number(material.stockValue || 0) },
      { Field: 'Alert / Reorder Level', Value: Number(material.alertLevel || 0) },
      { Field: 'Stock Health Status', Value: material.stockHealth },
      { Field: '', Value: '' },
      { Field: '--- SUMMARY METRICS ---', Value: '' },
      { Field: 'Total Lifetime Purchased Qty', Value: summary?.totalPurchasedQty || 0 },
      { Field: 'Total Lifetime Purchased Value (INR)', Value: summary?.totalPurchasedValue || 0 },
      { Field: 'Total Inwarded Qty (GRN)', Value: summary?.totalInwardedQty || 0 },
      { Field: 'Total Consumed in Production', Value: summary?.totalConsumedQty || 0 },
      { Field: 'Total Production Consumption Cost (INR)', Value: summary?.totalConsumedCost || 0 },
      { Field: 'Stock Adjustments Added (+)', Value: summary?.totalAdjustmentAddition || 0 },
      { Field: 'Stock Adjustments Subtracted (-)', Value: summary?.totalAdjustmentSubtraction || 0 },
      { Field: 'Net Adjusted Quantity', Value: summary?.netAdjustedQty || 0 },
      { Field: 'Total Wasted Quantity', Value: summary?.totalWastedQty || 0 },
      { Field: 'Total Wastage Loss (INR)', Value: summary?.totalWastedLoss || 0 },
      { Field: 'Report Generated At', Value: new Date().toLocaleString('en-IN') }
    ];
    const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Summary Overview');

    // 2. Purchases Sheet
    const poData = purchases.length > 0 ? purchases.map(p => ({
      'PO Reference': p.referenceNo,
      'Order Date': formatShortDate(p.orderDate),
      'Expected Delivery': formatShortDate(p.expectedDelivery),
      'Supplier Name': p.supplierName,
      'Supplier Contact': p.supplierContact || 'N/A',
      'Ordered Quantity': p.orderedQty,
      'Unit': p.uom,
      'Unit Price (INR)': p.unitPrice,
      'Item Total (INR)': p.itemTotal,
      'PO Grand Total (INR)': p.grandTotal,
      'PO Status': p.status,
      'Payment Status': p.paymentStatus,
      'Paid Amount (INR)': p.paidAmount,
      'Created By': p.createdBy || 'N/A'
    })) : [{ Note: 'No purchase orders recorded for this raw material' }];
    const poSheet = XLSX.utils.json_to_sheet(poData);
    XLSX.utils.book_append_sheet(workbook, poSheet, 'Purchases (POs)');

    // 3. GRN & Batches Sheet
    const grnData = grnReceipts.length > 0 ? grnReceipts.map(g => ({
      'GRN Reference': g.referenceNo,
      'Received Date': formatShortDate(g.receivedDate),
      'PO Reference': g.poReferenceNo,
      'Supplier': g.supplierName,
      'Expected Qty': g.expectedQty,
      'Actual Received Qty': g.actualReceivedQty,
      'Unit': material.unit,
      'Short Delivery': g.isShortDelivery ? 'YES' : 'NO',
      'Gate Receiver': g.receivedByName,
      'Challan Number': g.challanNumber || 'N/A',
      'Invoice Number': g.invoiceNumber || 'N/A',
      'Invoice Date': formatShortDate(g.invoiceDate),
      'Vehicle Number': g.vehicleNumber || 'N/A',
      'Driver Name': g.driverName || 'N/A',
      'Batch Number': g.batch?.batchNumber || 'N/A',
      'Storage Location': g.batch?.storageLocation || 'N/A',
      'Batch Net Qty': g.batch?.netQty || 'N/A',
      'Batch Expiry': formatShortDate(g.batch?.expiryDate),
      'Batch Status': g.batch?.status || 'N/A'
    })) : [{ Note: 'No GRN inward receipts recorded for this raw material' }];
    const grnSheet = XLSX.utils.json_to_sheet(grnData);
    XLSX.utils.book_append_sheet(workbook, grnSheet, 'GRN & Batches');

    // 4. Lab & QC Reports Sheet
    const labData = labReports.length > 0 ? labReports.map(l => ({
      'Lab Test ID': l.labTestId || l.id,
      'GRN Reference': l.grnReferenceNo,
      'PO Reference': l.poReferenceNo,
      'Supplier': l.supplierName,
      'Tested Date': formatShortDate(l.testDate),
      'QC Overall Decision': l.overallDecision,
      'Inspection Status': l.status,
      'Tested By (Inspector)': l.testedByName,
      'Sample Qty Tested': l.sampleQty,
      'Assigned Expiry Date': formatShortDate(l.expiryDate),
      'Findings & Notes': l.testNotes || 'N/A',
      'Manual Override Reason': l.overrideReason || 'N/A'
    })) : [{ Note: 'No lab/QC tests recorded for this raw material' }];
    const labSheet = XLSX.utils.json_to_sheet(labData);
    XLSX.utils.book_append_sheet(workbook, labSheet, 'Lab & QC Reports');

    // 5. Stock Adjustments Sheet
    const adjData = stockAdjustments.length > 0 ? stockAdjustments.map(a => ({
      'Adjustment ID': a.id,
      'Date & Time': formatDate(a.createdAt),
      'Type': a.type,
      'Quantity': a.quantity,
      'Unit': material.unit,
      'Reason / Notes': a.notes,
      'Adjusted By': a.userName,
      'User Role': a.userRole
    })) : [{ Note: 'No stock adjustments recorded for this raw material' }];
    const adjSheet = XLSX.utils.json_to_sheet(adjData);
    XLSX.utils.book_append_sheet(workbook, adjSheet, 'Stock Adjustments');

    // 6. RM Wastage Sheet
    const wasteData = wasteRecords.length > 0 ? wasteRecords.map(w => ({
      'Waste Reference': w.referenceNo,
      'Date': formatShortDate(w.date),
      'Wasted Quantity': w.quantity,
      'Unit': w.uom,
      'Loss Amount (INR)': w.lossAmount,
      'Reason / Notes': w.notes,
      'Responsible Person': w.responsiblePerson,
      'Logged By': w.createdBy
    })) : [{ Note: 'No wastage records logged for this raw material' }];
    const wasteSheet = XLSX.utils.json_to_sheet(wasteData);
    XLSX.utils.book_append_sheet(workbook, wasteSheet, 'RM Wastage');

    // 7. Production Usage Sheet
    const usageData = productionUsages.length > 0 ? productionUsages.map(u => ({
      'Production Batch Number': u.batchNumber,
      'Finished Product': u.productName,
      'Date': formatShortDate(u.date),
      'Required Quantity': u.requiredQty,
      'Actual Used Quantity': u.actualUsedQty,
      'Unit': material.unit,
      'Unit Cost (INR)': u.unitCost,
      'Total Cost (INR)': u.totalCost,
      'Usage Status': u.usageStatus,
      'Batch Status': u.batchStatus
    })) : [{ Note: 'No production batch consumption recorded for this raw material' }];
    const usageSheet = XLSX.utils.json_to_sheet(usageData);
    XLSX.utils.book_append_sheet(workbook, usageSheet, 'Production Usage');

    // 8. Purchase Returns Sheet (if any)
    if (purchaseReturns.length > 0) {
      const returnData = purchaseReturns.map(r => ({
        'Return Reference': r.referenceNo,
        'Return Date': formatShortDate(r.returnDate),
        'Supplier': r.supplierName,
        'PO Reference': r.poReferenceNo,
        'GRN Reference': r.grnReferenceNo,
        'Returned Quantity': r.returnQty,
        'Unit': material.unit,
        'Return Reason': r.returnReason,
        'Reason Description': r.reasonDescription || 'N/A',
        'Status': r.status,
        'Created By': r.createdByName
      }));
      const returnSheet = XLSX.utils.json_to_sheet(returnData);
      XLSX.utils.book_append_sheet(workbook, returnSheet, 'Purchase Returns');
    }

    // 9. Full Chronological Audit Timeline Sheet
    const timelineData = timeline.length > 0 ? timeline.map(t => ({
      'Date & Time': formatDate(t.timestamp),
      'Event Type': t.type,
      'Title': t.title,
      'Details': t.subtitle,
      'Status': t.status || 'N/A',
      'Actor / Logged By': t.user || 'N/A'
    })) : [{ Note: 'No activity recorded for this raw material' }];
    const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
    XLSX.utils.book_append_sheet(workbook, timelineSheet, 'Audit Timeline');

    // File Name
    const cleanCode = (material.code || 'RM').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanName = (material.name || 'Material').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `${cleanCode}_${cleanName}_Lifecycle_Report_${dateStamp}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'PURCHASE_ORDER':
        return <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'GRN_RECEIVE':
        return <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'INVENTORY_BATCH':
        return <Warehouse className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'LAB_QC':
        return <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'STOCK_ADJUSTMENT':
        return <RotateCcw className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'RM_WASTE':
        return <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'PRODUCTION_USAGE':
        return <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'PURCHASE_RETURN':
        return <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden print:static print:inset-auto print:overflow-visible">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200 print:hidden"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 print:static print:inset-auto print:pl-0">
        <div 
          className={`w-screen ${
            isExpanded ? 'max-w-6xl' : 'max-w-4xl'
          } bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col h-full transition-all duration-300 ease-out animate-in slide-in-from-right duration-300 print:max-w-full print:shadow-none print:border-none`}
        >
          {/* ────────────────── TOP STICKY HEADER ────────────────── */}
          <div className="px-5 py-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shrink-0 z-10 flex items-center justify-between gap-4 print:border-b-2 print:border-slate-300">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    {material?.name || 'Raw Material Lifecycle History'}
                  </h2>
                  {material?.code && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {material.code}
                    </span>
                  )}
                  {material?.category && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                      {material.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  Comprehensive audit trail • Purchases, Gate Inward, QC Reports, Batches, Adjustments & Usages
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Refresh history data"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                title="Export Complete Lifecycle Report to Excel (.xlsx)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 transition-colors cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(prev => !prev)}
                title={isExpanded ? "Collapse width" : "Expand width"}
                className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                title="Close drawer"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ────────────────── SCROLLABLE BODY ────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6">
            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading lifecycle history...</p>
              </div>
            ) : error ? (
              <div className="py-12 px-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                <h3 className="text-base font-bold text-rose-800 dark:text-rose-300">Failed to load material history</h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto">
                  {error.response?.data?.error || error.message || 'An error occurred while querying history data.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                {/* ────────────────── EXECUTIVE KPI TILES ────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Current Stock */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Warehouse className="w-3 h-3" /> Current Stock
                    </span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                      {material?.currentStock?.toLocaleString()}
                      <span className="text-xs font-semibold text-slate-500 uppercase">{material?.unit}</span>
                    </div>
                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium truncate">
                      Valued: {formatCurrency(material?.stockValue)}
                    </div>
                  </div>

                  {/* Total Purchased */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" /> Purchased
                    </span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                      {summary?.totalPurchasedQty?.toLocaleString() || 0}
                      <span className="text-xs font-semibold text-slate-500 uppercase">{material?.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      Total: {formatCurrency(summary?.totalPurchasedValue)}
                    </div>
                  </div>

                  {/* Total Inwarded (GRN) */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Inwarded
                    </span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                      {summary?.totalInwardedQty?.toLocaleString() || 0}
                      <span className="text-xs font-semibold text-slate-500 uppercase">{material?.unit}</span>
                    </div>
                    <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                      {grnReceipts.length} GRN Receipts
                    </div>
                  </div>

                  {/* Consumed in Production */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Consumed
                    </span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                      {summary?.totalConsumedQty?.toLocaleString() || 0}
                      <span className="text-xs font-semibold text-slate-500 uppercase">{material?.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      Cost: {formatCurrency(summary?.totalConsumedCost)}
                    </div>
                  </div>

                  {/* Stock Adjustments */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Net Adjusted
                    </span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                      {summary?.netAdjustedQty > 0 ? `+${summary.netAdjustedQty}` : (summary?.netAdjustedQty || 0)}
                      <span className="text-xs font-semibold text-slate-500 uppercase">{material?.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      +{summary?.totalAdjustmentAddition || 0} / -{summary?.totalAdjustmentSubtraction || 0}
                    </div>
                  </div>

                  {/* Wastage */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Wasted
                    </span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-baseline gap-1">
                      {summary?.totalWastedQty?.toLocaleString() || 0}
                      <span className="text-xs font-semibold text-slate-500 uppercase">{material?.unit}</span>
                    </div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate">
                      Loss: {formatCurrency(summary?.totalWastedLoss)}
                    </div>
                  </div>
                </div>

                {/* ────────────────── EMPTY STATE IF NO HISTORY ────────────────── */}
                {!summary?.hasHistory ? (
                  <div className="py-14 px-6 rounded-3xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                      <Inbox className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        There is no history for this raw material yet
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        No purchase orders, GRN gate entries, lab QC inspections, inventory batches, manual stock adjustments, or manufacturing consumptions have been recorded for <span className="font-semibold text-slate-700 dark:text-slate-300">{material?.name}</span> ({material?.code}).
                      </p>
                    </div>

                    <div className="inline-flex flex-wrap items-center justify-center gap-2 pt-2">
                      <span className="text-[11px] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
                        Current Stock: {material?.currentStock} {material?.unit}
                      </span>
                      <span className="text-[11px] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
                        Alert Threshold: {material?.alertLevel} {material?.unit}
                      </span>
                      <span className="text-[11px] px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
                        Standard Rate: {formatCurrency(material?.ratePerUnit)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ────────────────── NAVIGATION TABS ────────────────── */}
                    <div className="border-b border-slate-200 dark:border-slate-800 print:hidden">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
                        {[
                          { id: 'timeline', label: 'All Timeline', count: timeline.length, icon: Clock },
                          { id: 'purchases', label: 'Purchases (POs)', count: purchases.length, icon: ShoppingCart },
                          { id: 'grn', label: 'GRN & Batches', count: grnReceipts.length, icon: Truck },
                          { id: 'lab', label: 'Lab & QC Reports', count: labReports.length, icon: ShieldCheck },
                          { id: 'adjustments', label: 'Stock Adjustments', count: stockAdjustments.length, icon: RotateCcw },
                          { id: 'waste', label: 'RM Wastage', count: wasteRecords.length, icon: Trash2 },
                          { id: 'usage', label: 'Production Usage', count: productionUsages.length, icon: Cpu },
                          ...(purchaseReturns.length > 0 ? [{ id: 'returns', label: 'Returns', count: purchaseReturns.length, icon: RotateCcw }] : []),
                        ].map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{tab.label}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {tab.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ────────────────── TAB CONTENTS ────────────────── */}

                    {/* 1. TIMELINE TAB */}
                    {activeTab === 'timeline' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Chronological Lifecycle Events ({timeline.length})
                          </h3>
                        </div>

                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                          {timeline.map((event) => {
                            return (
                              <div key={event.id} className="relative group">
                                {/* Circle icon node */}
                                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center group-hover:border-indigo-500 transition-colors shadow-xs">
                                  {getTimelineIcon(event.type)}
                                </div>

                                {/* Event Card */}
                                <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {event.title}
                                      </span>
                                      {event.status && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                          {event.status}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {formatDate(event.timestamp)}
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {event.subtitle}
                                  </p>

                                  {event.user && (
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                                      <User className="w-3 h-3" /> Logged by: <span className="font-semibold text-slate-600 dark:text-slate-300">{event.user}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. PURCHASES TAB */}
                    {activeTab === 'purchases' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Purchase Orders ({purchases.length})
                          </h3>
                        </div>

                        {purchases.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                            No purchase orders found for this material.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="p-3">PO Reference</th>
                                  <th className="p-3">Order Date</th>
                                  <th className="p-3">Supplier</th>
                                  <th className="p-3 text-right">Qty</th>
                                  <th className="p-3 text-right">Unit Rate</th>
                                  <th className="p-3 text-right">Item Total</th>
                                  <th className="p-3 text-center">Status</th>
                                  <th className="p-3 text-center">Payment</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {purchases.map((po) => (
                                  <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                      {po.referenceNo}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                      {formatShortDate(po.orderDate)}
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-slate-900 dark:text-white">{po.supplierName}</div>
                                      {po.supplierContact && (
                                        <div className="text-[10px] text-slate-400">{po.supplierContact}</div>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                      {po.orderedQty?.toLocaleString()} <span className="text-[10px] font-semibold text-slate-400">{po.uom}</span>
                                    </td>
                                    <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                      {formatCurrency(po.unitPrice)}
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                      {formatCurrency(po.itemTotal)}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                        {po.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        po.paymentStatus === 'PAID'
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                          : po.paymentStatus === 'PARTIALLY_PAID'
                                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                      }`}>
                                        {po.paymentStatus}
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

                    {/* 3. GRN & INWARD BATCHES TAB */}
                    {activeTab === 'grn' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            GRN Receipts & Inward Batches ({grnReceipts.length})
                          </h3>
                        </div>

                        {grnReceipts.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                            No GRN inward receipts found for this material.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {grnReceipts.map((grn) => (
                              <div key={grn.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                      {grn.referenceNo}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900">
                                      Gate Entry: {grn.grnStatus}
                                    </span>
                                    {grn.inventoryStatus === 'UPLOADED' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                        Uploaded to Stock
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500 font-mono">
                                    Received: {formatDate(grn.receivedDate)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-semibold">PO Reference</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{grn.poReferenceNo}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-semibold">Supplier</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{grn.supplierName}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-semibold">Expected / Received</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {grn.expectedQty} / {grn.actualReceivedQty} {material?.unit}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-semibold">Receiver</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{grn.receivedByName}</span>
                                  </div>
                                </div>

                                {(grn.challanNumber || grn.invoiceNumber || grn.vehicleNumber) && (
                                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                    {grn.challanNumber && <span>Challan: <strong className="text-slate-700 dark:text-slate-300">{grn.challanNumber}</strong></span>}
                                    {grn.invoiceNumber && <span>Invoice: <strong className="text-slate-700 dark:text-slate-300">{grn.invoiceNumber}</strong></span>}
                                    {grn.vehicleNumber && <span>Vehicle: <strong className="text-slate-700 dark:text-slate-300">{grn.vehicleNumber}</strong></span>}
                                    {grn.driverName && <span>Driver: <strong className="text-slate-700 dark:text-slate-300">{grn.driverName}</strong></span>}
                                  </div>
                                )}

                                {/* Linked Inventory Batch */}
                                {grn.batch && (
                                  <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                      <Warehouse className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      <div>
                                        <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{grn.batch.batchNumber}</span>
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 ml-2">Location: {grn.batch.storageLocation}</span>
                                      </div>
                                    </div>
                                    <div className="text-right text-[11px] text-emerald-700 dark:text-emerald-300">
                                      Net Qty: <strong>{grn.batch.netQty} {material?.unit}</strong>
                                      {grn.batch.expiryDate && (
                                        <span className="ml-2 font-mono">Exp: {formatShortDate(grn.batch.expiryDate)}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. LAB & QC REPORTS TAB */}
                    {activeTab === 'lab' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Quality Control & Lab Inspection Reports ({labReports.length})
                          </h3>
                        </div>

                        {labReports.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                            No laboratory test reports found for this material.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {labReports.map((lab) => {
                              const isApproved = lab.overallDecision === 'APPROVED';
                              const isRejected = lab.overallDecision === 'REJECTED';
                              return (
                                <div key={lab.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                                        isApproved
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                          : isRejected
                                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      }`}>
                                        {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : isRejected ? <XCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                        QC Decision: {lab.overallDecision}
                                      </span>
                                      <span className="font-mono text-xs text-slate-500">
                                        GRN: {lab.grnReferenceNo}
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono">
                                      Tested: {formatDate(lab.testDate)}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <span className="text-[10px] text-slate-400 block font-semibold">Tested By</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{lab.testedByName}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 block font-semibold">Sample Tested</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{lab.sampleQty} {material?.unit}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 block font-semibold">Expiry Date</span>
                                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{formatShortDate(lab.expiryDate)}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-slate-400 block font-semibold">Supplier</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{lab.supplierName}</span>
                                    </div>
                                  </div>

                                  {lab.testNotes && (
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold text-slate-700 dark:text-slate-200 block text-[10px] uppercase">Test Findings & Observations:</span>
                                      {lab.testNotes}
                                    </div>
                                  )}

                                  {lab.overrideReason && (
                                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                                      <span className="font-bold block text-[10px] uppercase">Manual Override Reason:</span>
                                      {lab.overrideReason}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. STOCK ADJUSTMENTS TAB */}
                    {activeTab === 'adjustments' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Manual Stock Adjustments ({stockAdjustments.length})
                          </h3>
                        </div>

                        {stockAdjustments.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                            No manual stock adjustments logged for this material.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="p-3">Date & Time</th>
                                  <th className="p-3">Type</th>
                                  <th className="p-3 text-right">Quantity</th>
                                  <th className="p-3">Reason / Notes</th>
                                  <th className="p-3">Adjusted By</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stockAdjustments.map((adj) => {
                                  const isAdd = adj.type === 'ADDITION';
                                  return (
                                    <tr key={adj.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                      <td className="p-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                        {formatDate(adj.createdAt)}
                                      </td>
                                      <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                                          isAdd
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                        }`}>
                                          {isAdd ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                          {isAdd ? '+ ADDITION' : '- SUBTRACTION'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                        {isAdd ? `+${adj.quantity}` : `-${adj.quantity}`} {material?.unit}
                                      </td>
                                      <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs">
                                        {adj.notes}
                                      </td>
                                      <td className="p-3">
                                        <div className="font-semibold text-slate-800 dark:text-slate-200">{adj.userName}</div>
                                        <div className="text-[10px] text-slate-400">{adj.userRole}</div>
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

                    {/* 6. RM WASTAGE TAB */}
                    {activeTab === 'waste' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Raw Material Wastage Records ({wasteRecords.length})
                          </h3>
                        </div>

                        {wasteRecords.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                            No wastage records logged for this material.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="p-3">Waste Ref</th>
                                  <th className="p-3">Date</th>
                                  <th className="p-3 text-right">Wasted Qty</th>
                                  <th className="p-3 text-right">Estimated Loss</th>
                                  <th className="p-3">Reason / Notes</th>
                                  <th className="p-3">Responsible</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {wasteRecords.map((waste) => (
                                  <tr key={waste.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                                      {waste.referenceNo}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                      {formatShortDate(waste.date)}
                                    </td>
                                    <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                      {waste.quantity?.toLocaleString()} {waste.uom}
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                      {formatCurrency(waste.lossAmount)}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs">
                                      {waste.notes}
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-slate-800 dark:text-slate-200">{waste.responsiblePerson}</div>
                                      <div className="text-[10px] text-slate-400">Logged by: {waste.createdBy}</div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7. PRODUCTION USAGE TAB */}
                    {activeTab === 'usage' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Consumed in Production Batches ({productionUsages.length})
                          </h3>
                        </div>

                        {productionUsages.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                            No production batch consumption recorded for this material.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="p-3">Batch Number</th>
                                  <th className="p-3">Finished Product</th>
                                  <th className="p-3">Date</th>
                                  <th className="p-3 text-right">Required Qty</th>
                                  <th className="p-3 text-right">Used Qty</th>
                                  <th className="p-3 text-right">Unit Cost</th>
                                  <th className="p-3 text-right">Total Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {productionUsages.map((usage) => (
                                  <tr key={usage.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                      {usage.batchNumber}
                                    </td>
                                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                      {usage.productName}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                      {formatShortDate(usage.date)}
                                    </td>
                                    <td className="p-3 text-right text-slate-500">
                                      {usage.requiredQty?.toLocaleString()} {material?.unit}
                                    </td>
                                    <td className="p-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                      {usage.actualUsedQty?.toLocaleString()} {material?.unit}
                                    </td>
                                    <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                      {formatCurrency(usage.unitCost)}
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                      {formatCurrency(usage.totalCost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 8. PURCHASE RETURNS TAB */}
                    {activeTab === 'returns' && purchaseReturns.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Purchase Returns ({purchaseReturns.length})
                          </h3>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                              <tr>
                                <th className="p-3">Return Ref</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Supplier</th>
                                <th className="p-3 text-right">Returned Qty</th>
                                <th className="p-3">Return Reason</th>
                                <th className="p-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {purchaseReturns.map((ret) => (
                                <tr key={ret.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="p-3 font-mono font-bold text-red-600 dark:text-red-400">
                                    {ret.referenceNo}
                                  </td>
                                  <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                    {formatShortDate(ret.returnDate)}
                                  </td>
                                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                                    {ret.supplierName}
                                  </td>
                                  <td className="p-3 text-right font-black text-red-600 dark:text-red-400">
                                    {ret.returnQty} {material?.unit}
                                  </td>
                                  <td className="p-3 text-slate-600 dark:text-slate-300">
                                    <div className="font-semibold">{ret.returnReason}</div>
                                    {ret.reasonDescription && <div className="text-[10px] text-slate-400">{ret.reasonDescription}</div>}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      {ret.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* ────────────────── PINNED STICKY FOOTER ────────────────── */}
          <div className="px-5 py-3.5 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {summary?.hasHistory
                ? `Total ${timeline.length} lifecycle events recorded across purchase, inward, QC, adjustments, and usages.`
                : 'No historical transactions recorded yet.'}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-9 px-3.5 text-xs rounded-xl flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Export Excel Report (.xlsx)
              </Button>
              <Button
                size="sm"
                onClick={onClose}
                className="h-9 px-4 text-xs rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Truck, Package, Search, Eye, ClipboardCheck, AlertCircle, Clock,
  CheckCircle2, RefreshCw, QrCode, FlaskConical, XCircle, Printer,
  ChevronRight, Calendar, X, Loader2, PackageCheck,
  Layers, ArrowRight, FileText
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SortSelect } from '@/components/ui/SortSelect';
import _QRCode from 'react-qr-code';
import { Pagination } from '@/components/ui/Pagination';

const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

const safeFormatDate = (dateVal, formatStr = 'dd MMM yyyy') => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return format(d, formatStr);
  } catch {
    return '—';
  }
};

const GRN_STATUS_CONFIG = {
  PENDING_LAB:    { label: 'Pending Lab',    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: FlaskConical },
  LAB_APPROVED:   { label: 'Lab Approved',   color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  LAB_REJECTED:   { label: 'Lab Rejected',   color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle },
  LAB_RESAMPLE:   { label: 'Re-sample',      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: AlertCircle },
};

function GRNStatusPill({ status }) {
  const cfg = GRN_STATUS_CONFIG[status] || { label: status || 'Unknown', color: 'bg-slate-100 text-slate-605 border-slate-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${cfg.color} select-none shadow-sm`}>
      <Icon className="w-3 h-3 animate-pulse" /> {cfg.label}
    </span>
  );
}

function POStatusPill({ d }) {
  if (d.deliveredStatus === 'FULLY_DELIVERED' || d.isFullyDelivered) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm select-none">
        <CheckCircle2 className="w-3 h-3" /> Fully Delivered
      </span>
    );
  }
  if (d.isPartiallyReceived || d.status === 'PARTIALLY_RECEIVED' || (d.totalReceivedQty > 0 && d.pendingQty > 0)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm select-none animate-pulse">
        <RefreshCw className="w-3 h-3 text-amber-500" /> Receive Pending ({d.pendingQty} {d.uom?.abbreviation || ''})
      </span>
    );
  }
  if (!d.hasGrn) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 select-none shadow-sm">
        <Clock className="w-3 h-3" /> Awaiting Delivery
      </span>
    );
  }
  return <GRNStatusPill status={d.grnStatus} />;
}

// QR scan detail modal
function QRDetailModal({ delivery, onClose }) {
  if (!delivery) return null;
  const qrPayload = JSON.stringify({
    poNumber: delivery.referenceNo,
    supplierName: delivery.supplierName,
    rawMaterial: delivery.name,
    quantity: delivery.quantity,
    uom: delivery.uom?.abbreviation,
    expectedDelivery: delivery.expectedDelivery,
    paymentStatus: delivery.amount ? `₹${Number(delivery.amount).toLocaleString('en-IN')}` : 'N/A',
    grnStatus: delivery.grnStatus,
    actualReceivedQty: delivery.actualReceivedQty || delivery.totalReceivedQty,
    pendingQty: delivery.pendingQty,
    refundAmount: delivery.refundAmount,
    stage: delivery.isFullyDelivered ? 'FULLY_DELIVERED' : (delivery.totalReceivedQty > 0 ? 'PARTIALLY_RECEIVED' : 'PO_RAISED'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <QrCode className="w-4.5 h-4.5 text-indigo-500" /> QR Details
          </h3>
          <button onClick={onClose} className="text-slate-450 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold">×</button>
        </div>

        <div className="flex justify-center py-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
            <QRCode value={qrPayload} size={150} level="M" fgColor="#0f172a" />
          </div>
        </div>

        <div className="space-y-1 text-[11px]">
          {[
            { label: 'PO Number', value: delivery.referenceNo },
            { label: 'Supplier', value: delivery.supplierName || '—' },
            { label: 'Raw Material', value: delivery.name },
            { label: 'Ordered Qty', value: `${Number(delivery.totalOrderedQty || delivery.quantity).toLocaleString()} ${delivery.uom?.abbreviation || ''}` },
            { label: 'Total Received', value: `${Number(delivery.totalReceivedQty || 0).toLocaleString()} ${delivery.uom?.abbreviation || ''}` },
            { label: 'Pending Qty', value: `${Number(delivery.pendingQty || 0).toLocaleString()} ${delivery.uom?.abbreviation || ''}` },
            { label: 'Expected Delivery', value: safeFormatDate(delivery.expectedDelivery) },
            { label: 'Payment Amount', value: `₹${Number(delivery.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            ...(delivery.hasGrn ? [
              { label: 'Latest Status', value: delivery.grnStatus?.replace('_', ' ') || '—' },
              { label: 'Refund Amount', value: delivery.refundAmount != null ? `₹${Number(delivery.refundAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—' },
              { label: 'Latest Delivery Date', value: safeFormatDate(delivery.receivedDate) },
            ] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="font-bold text-slate-850 dark:text-slate-100 text-right">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="flex-1 gap-1.5 rounded-xl h-9 text-xs border-slate-205">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button size="sm" onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs">Close</Button>
        </div>
      </div>
    </div>
  );
}

// Stylish In-App Confirmation Modal to Mark PO as Fully Delivered
function ConfirmFullyDeliveredModal({ delivery, onClose, onConfirm, isSubmitting }) {
  if (!delivery) return null;

  const totalOrdered = Number(delivery.totalOrderedQty || delivery.quantity || 0);
  const totalReceived = Number(delivery.totalReceivedQty || 0);
  const pendingQty = Number(delivery.pendingQty != null ? delivery.pendingQty : Math.max(0, totalOrdered - totalReceived));
  const uom = delivery.uom?.abbreviation || '';
  const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 100;
  const isAllArrived = pendingQty <= 0 || totalReceived >= totalOrdered;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-2xl shadow-emerald-500/10 z-10 animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top vibrant gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

        {/* Header with Icon, Title, and Close Button */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                Mark as Fully Delivered?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Conclude order and move to Delivered
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PO Details Card */}
        <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                {delivery.referenceNo || 'PO'}
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                {delivery.supplierName || 'Supplier'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
              {delivery.name}
            </span>
          </div>

          {/* Quantity Progress Bar & Stats */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Received Fulfillment</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} {uom} ({pct}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  pct >= 100 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                    : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium pt-0.5">
              <span className={isAllArrived ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                {isAllArrived ? '✓ 100% of quantity has arrived' : `⚠ ${pendingQty.toLocaleString()} ${uom} still pending`}
              </span>
              <span className="text-slate-400">
                {delivery.shipmentsCount || 1} shipment logged
              </span>
            </div>
          </div>
        </div>

        {/* Informational Guidance Callout */}
        <div className="mt-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-3 text-[11.5px] text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <span>
              This action will officially conclude the procurement workflow and move this PO to the <strong>Delivered</strong> archive tab.
              {isAllArrived ? ' All items have arrived safely.' : ' Any unreceived quantity balance will be finalized.'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={() => onConfirm(delivery.id)}
            disabled={isSubmitting}
            className="rounded-xl h-10 px-5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Marking Delivered...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Delivery Done</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Stylish Multi-GRN Shipments Modal
function POGRNsListModal({ delivery, onClose, onQRView }) {
  const navigate = useNavigate();
  if (!delivery) return null;

  const shipments = (delivery.grnList && delivery.grnList.length > 0)
    ? delivery.grnList
    : (delivery.grnId ? [{
        id: delivery.grnId,
        referenceNo: delivery.referenceNo ? `GRN (${delivery.referenceNo})` : 'GRN-RECORD',
        receivedDate: delivery.receivedDate,
        status: delivery.grnStatus,
        inventoryStatus: 'UPLOADED',
        receivedQty: delivery.totalReceivedQty || delivery.quantity,
        items: delivery.items || []
      }] : []);

  const totalOrdered = Number(delivery.totalOrderedQty || delivery.quantity || 0);
  const totalReceived = Number(delivery.totalReceivedQty || 0);
  const pendingQty = Number(delivery.pendingQty != null ? delivery.pendingQty : Math.max(0, totalOrdered - totalReceived));
  const uom = delivery.uom?.abbreviation || 'pcs';
  const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 100;
  const isAllArrived = pendingQty <= 0 || totalReceived >= totalOrdered;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl z-10 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top vibrant gradient accent line */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  Shipment Receipts (GRNs)
                </h3>
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                  {delivery.referenceNo}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {shipments.length} {shipments.length === 1 ? 'Shipment' : 'Shipments'} Logged
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Supplier: <strong className="text-slate-700 dark:text-slate-200">{delivery.supplierName || '—'}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PO Progress bar summary banner */}
        <div className="px-4 sm:px-5 py-3 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-100/60 dark:border-indigo-900/40 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Fulfillment Progress</span>
            <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">
              {totalReceived.toLocaleString()} / {totalOrdered.toLocaleString()} {uom} ({pct}%)
            </span>
          </div>
          <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-amber-500 to-indigo-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] pt-1">
            <span className={isAllArrived ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
              {isAllArrived ? '✓ All quantities received for this order' : `⚠ ${pendingQty.toLocaleString()} ${uom} pending`}
            </span>
            <span className="text-slate-400 text-[10px]">
              Expected: {safeFormatDate(delivery.expectedDelivery)}
            </span>
          </div>
        </div>

        {/* Shipment Cards Body - Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {shipments.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No GRN shipments logged yet</p>
              <p className="text-xs mt-1">Receive deliveries to generate GRN records for this order.</p>
            </div>
          ) : (
            shipments.map((grn, idx) => {
              const cfg = GRN_STATUS_CONFIG[grn.status] || { label: grn.status || 'Received', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };
              const StatusIcon = cfg?.icon || Clock;

              return (
                <div
                  key={grn.id || idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 relative group"
                >
                  {/* Top line of shipment card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                        Shipment #{idx + 1}
                      </span>
                      <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                        {grn.referenceNo}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${cfg.color || 'border-slate-200'}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{cfg.label}</span>
                      </span>
                      {grn.inventoryStatus === 'UPLOADED' && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Stock In
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{safeFormatDate(grn.receivedDate, 'dd MMM yyyy, hh:mm a')}</span>
                    </div>
                  </div>

                  {/* Metadata line: Invoice, LR, Receiver */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/70 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Received Qty</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Number(grn.receivedQty || 0).toLocaleString()} {uom}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Invoice #</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {grn.invoiceNumber || '—'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Received By</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {grn.receiverName || 'Materials Receiver'}
                      </span>
                    </div>
                  </div>

                  {/* Items received in this shipment */}
                  {grn.items && grn.items.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Package className="w-3 h-3 text-indigo-500" />
                        <span>Materials Received ({grn.items.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {grn.items.map((it, iIdx) => (
                          <div
                            key={it.id || iIdx}
                            className="bg-white dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px]"
                          >
                            <div className="truncate pr-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={it.rmName}>
                                {it.rmName}
                              </span>
                              {it.batchNumber && (
                                <span className="font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1 py-0.2 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                                  {it.batchNumber}
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                              {Number(it.actualReceivedQty || 0).toLocaleString()} {uom}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions for this GRN */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onQRView(grn)}
                      className="h-8 px-2.5 text-xs text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 cursor-pointer rounded-xl"
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1" />
                      QR
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => navigate(`/grn/view/${grn.id}`)}
                      className="h-8 px-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-3xs cursor-pointer inline-flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span>View GRN File</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/grn/list?search=${encodeURIComponent(delivery.referenceNo)}`)}
            className="w-full sm:w-auto h-9 px-3.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-3xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View All in GRN Records List →</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeliveryCard({ d, navigate, onQRView, canReceive, onMarkFullyDelivered, onOpenGRNModal }) {
  const isPartiallyReceived = d.isPartiallyReceived || d.status === 'PARTIALLY_RECEIVED' || (d.totalReceivedQty > 0 && d.pendingQty > 0);
  const isFullyDelivered = d.isFullyDelivered || d.deliveredStatus === 'FULLY_DELIVERED';

  return (
    <div className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-all duration-200 group">
      {/* Side accent color-coded (sleeker) */}
      <div className={`w-1.5 shrink-0 ${
        isFullyDelivered
          ? 'bg-emerald-500'
          : isPartiallyReceived
            ? 'bg-amber-500'
            : 'bg-indigo-500'
      }`} />

      <div className="flex-1 p-4 min-w-0 flex flex-col justify-between">
        <div>
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 mb-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs tracking-tight">{d.referenceNo}</span>
                <POStatusPill d={d} />
              </div>
              {d.items && Array.isArray(d.items) && d.items.length > 1 ? (
                <div className="mt-2.5 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                      <Package className="w-3 h-3" /> Items ({d.items.length})
                    </p>
                    {d.totalReceivedQty > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {d.pendingQty > 0 ? `${d.pendingQty} ${d.uom?.abbreviation || ''} Pending` : 'All Quantities Arrived (Pending Final Close)'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {d.items.map((item, idx) => {
                      const uom = item.uomLabel || d.uom?.abbreviation || 'units';
                      const ord = Number(item.orderedQty ?? item.quantity ?? 0);
                      const rcv = Number(item.receivedQty ?? 0);
                      const pnd = Number(item.pendingQty ?? Math.max(0, ord - rcv));
                      const isDone = item.isComplete || (rcv >= ord && ord > 0);

                      return (
                        <div key={idx} className="flex justify-between items-center text-[11px] py-1 border-b border-dashed border-slate-100 dark:border-slate-800 last:border-b-0">
                          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDone ? 'bg-emerald-500' : (rcv > 0 ? 'bg-amber-500' : 'bg-slate-300')}`} />
                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate" title={item.name}>{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {d.totalReceivedQty > 0 ? (
                              <>
                                <span className="font-mono text-slate-650 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                  {rcv} / {ord} <span className="text-[9px] font-normal text-slate-400">{uom}</span>
                                </span>
                                {isDone ? (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" /> Received
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    ({pnd} pending)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="font-mono text-slate-650 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                {ord} <span className="text-[9px] font-normal text-slate-400">{uom}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight truncate max-w-[180px]" title={d.name}>{d.name}</span>
                  <span className="font-mono text-slate-500 font-bold text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-150 dark:border-slate-800 px-1 py-0.2 rounded">
                    {d.totalReceivedQty > 0 
                      ? `${d.totalReceivedQty} / ${Number(d.quantity).toLocaleString()} ${d.uom?.abbreviation || ''}`
                      : `${Number(d.quantity).toLocaleString()} ${d.uom?.abbreviation || ''}`}
                  </span>
                  {d.totalReceivedQty > 0 && d.pendingQty > 0 && (
                    <span className="text-[10px] font-bold text-amber-600">({d.pendingQty} pending)</span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-slate-550 dark:text-slate-400 font-semibold">{d.supplierName}</div>
            </div>
            
            <div className="text-left sm:text-right shrink-0">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-extrabold">Value Expected</p>
              <p className="text-xs font-black text-slate-805 dark:text-white mt-0.5 font-mono">
                {d.amount ? `₹${Number(d.amount).toLocaleString('en-IN')}` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Multi-Shipment Progress Bar if any deliveries received */}
          {d.totalReceivedQty > 0 && (
            <div className="my-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Delivery Progress:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {d.totalReceivedQty} / {d.totalOrderedQty} {d.uom?.abbreviation || ''} ({Math.min(100, Math.round((d.totalReceivedQty / (d.totalOrderedQty || 1)) * 100))}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isFullyDelivered ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.min(100, (d.totalReceivedQty / (d.totalOrderedQty || 1)) * 100)}%` }} 
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                <span>{d.receiptCount || 1} shipment{d.receiptCount === 1 ? '' : 's'} logged</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {isFullyDelivered ? '0 pending' : `${d.pendingQty} ${d.uom?.abbreviation || ''} pending`}
                </span>
              </div>
            </div>
          )}
          
          <div className="text-2xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 my-1 flex-wrap">
            <Calendar className="w-3.5 h-3.5" />
            {!d.hasGrn ? (
              <span>Expected: {safeFormatDate(d.expectedDelivery)}</span>
            ) : (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-450 font-black">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Last Rcvd: {safeFormatDate(d.receivedDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 mt-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/purchase-orders/${d.id}`)}
            className="h-8 px-2 text-[11px] font-bold gap-1 text-slate-500 hover:text-indigo-655 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg"
          >
            <Eye className="w-3.5 h-3.5" /> 
            <span>View PO</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQRView(d)}
            className="h-8 px-2 text-[11px] font-bold gap-1 text-slate-500 hover:text-purple-650 dark:text-slate-400 dark:hover:text-purple-400 rounded-lg"
          >
            <QrCode className="w-3.5 h-3.5" /> 
            <span>QR</span>
          </Button>

          {d.grnId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenGRNModal(d)}
              className="h-8 px-2.5 text-[11px] font-bold gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-all cursor-pointer shadow-3xs hover:border-indigo-300"
              title={d.grnList && d.grnList.length > 1 ? `View all ${d.grnList.length} GRN shipments for this PO` : 'View Goods Received Note'}
            >
              <ChevronRight className="w-3.5 h-3.5" /> 
              <span>{d.grnList && d.grnList.length > 1 ? `GRN (${d.grnList.length})` : 'GRN'}</span>
            </Button>
          )}

          {/* If PO can receive deliveries */}
          {canReceive && !isFullyDelivered && (
            <div className="flex items-center gap-1.5 ml-auto">
              {d.totalReceivedQty > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMarkFullyDelivered(d)}
                  title="Mark PO as Fully Delivered (Close Order)"
                  className="h-8 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 border-emerald-300 rounded-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mark Done</span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => navigate(`/grn/receive/${d.id}`)}
                className="h-8 px-3 text-[11px] font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg active:scale-95 shadow-sm shadow-indigo-500/10 transition-all"
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> 
                <span>{d.totalReceivedQty > 0 ? "Receive Next" : "Receive"}</span>
              </Button>
            </div>
          )}

          {/* Completed badge if fully delivered */}
          {isFullyDelivered && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const STATS_COLORS = {
  blue: {
    bg: 'bg-blue-50/80 dark:bg-blue-950/20',
    border: 'border-blue-105 dark:border-blue-950/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/20',
    border: 'border-amber-105 dark:border-amber-950/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  emerald: {
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
    border: 'border-emerald-105 dark:border-emerald-950/20',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

export default function UpcomingDeliveriesPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canReceive = ['MAIN_MASTER', 'MATERIALS_RECEIVER'].includes(user?.role);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming | delivered
  const [qrDelivery, setQRDelivery] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [selectedPOGRNs, setSelectedPOGRNs] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6; // Grid displays 6 cards per page nicely

  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['upcoming-deliveries'],
    queryFn: async () => {
      const res = await api.get('/grn/upcoming');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const [markingDelivery, setMarkingDelivery] = useState(null);
  const [isSubmittingMarkDone, setIsSubmittingMarkDone] = useState(false);

  const executeMarkFullyDelivered = async (poId) => {
    setIsSubmittingMarkDone(true);
    try {
      await api.patch(`/grn/po/${poId}/mark-fully-delivered`);
      const refNo = markingDelivery?.referenceNo;
      setMarkingDelivery(null);
      await refetch();
      Swal.fire({
        icon: 'success',
        title: 'Delivery Completed!',
        text: `Purchase Order ${refNo || ''} has been marked as fully delivered and moved to the Delivered tab.`,
        confirmButtonColor: '#059669',
        timer: 3000,
        timerProgressBar: true,
        customClass: {
          popup: 'rounded-2xl shadow-xl',
          confirmButton: 'rounded-xl text-xs font-bold px-5 py-2.5 shadow-sm'
        }
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Action Failed',
        text: err.response?.data?.error || 'Failed to mark PO as fully delivered',
        confirmButtonColor: '#4f46e5',
        customClass: {
          popup: 'rounded-2xl shadow-xl',
          confirmButton: 'rounded-xl text-xs font-bold px-5 py-2.5 shadow-sm'
        }
      });
    } finally {
      setIsSubmittingMarkDone(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
  };

  const handleSortChange = (sortVal) => {
    setSortBy(sortVal);
    setCurrentPage(1);
  };

  const sortOptions = [
    { value: 'recent', label: 'Recent Expected' },
    { value: 'oldest', label: 'Oldest Expected' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'name_asc', label: 'Alphabet: A to Z' },
    { value: 'name_desc', label: 'Alphabet: Z to A' },
  ];

  // Split into upcoming (pending delivery) and delivered (fully fulfilled)
  // A PO strictly stays in upcoming until the user explicitly checks final delivery or marks it fully delivered
  const upcoming = deliveries.filter(d => 
    d.deliveredStatus !== 'FULLY_DELIVERED' && 
    !d.isFullyDelivered
  );
  const delivered = deliveries.filter(d => 
    d.deliveredStatus === 'FULLY_DELIVERED' || 
    d.isFullyDelivered
  );

  const activeList = activeTab === 'upcoming' ? upcoming : delivered;

  const searchLower = (search || '').trim().toLowerCase();
  const filtered = activeList.filter(d =>
    !searchLower ||
    d.referenceNo?.toLowerCase().includes(searchLower) ||
    d.name?.toLowerCase().includes(searchLower) ||
    d.supplierName?.toLowerCase().includes(searchLower)
  );

  const getSortDate = (d) => {
    const ts = new Date(d.receivedDate || d.expectedDelivery || d.createdAt || 0).getTime();
    return isNaN(ts) ? 0 : ts;
  };

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return getSortDate(b) - getSortDate(a);
    if (sortBy === 'oldest') return getSortDate(a) - getSortDate(b);
    if (sortBy === 'price_desc') return Number(b.amount || 0) - Number(a.amount || 0);
    if (sortBy === 'price_asc') return Number(a.amount || 0) - Number(b.amount || 0);
    if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });

  // Paginated Deliveries List
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedDeliveries = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Page Header (Compact & Professional) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/20 rounded-lg text-indigo-650 dark:text-indigo-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">GRN Deliveries</h1>
            <p className="text-xs text-slate-505 dark:text-slate-400">Manage PO receipts (lab rejected items excluded).</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto gap-1.5 rounded-xl h-8 text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats Cards Grid (Tighter & Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Total Active Orders', value: deliveries.length, color: 'blue' },
          { icon: Clock, label: 'Pending Deliveries', value: upcoming.length, color: 'amber' },
          { icon: CheckCircle2, label: 'Fully Delivered', value: delivered.length, color: 'emerald' },
        ].map(({ icon: Icon, label, value, color }) => {
          const colors = STATS_COLORS[color] || STATS_COLORS.blue;
          return (
            <div key={label} className={`bg-white dark:bg-slate-900 border ${colors.border} rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5 group`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text} shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-200`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest truncate">{label}</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-16 mt-0.5" />
                ) : (
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5 truncate tracking-tight">{value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs + Search + Sort Toolbar Panel (Compact) */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 p-4 rounded-2xl shadow-sm">
        {/* Tab switch buttons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-850 rounded-xl p-0.5 self-start shadow-inner">
          {[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'delivered', label: 'Delivered', count: delivered.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-605 dark:text-indigo-400 shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-500/20 dark:text-indigo-400'
                  : 'bg-slate-200 text-slate-550 dark:bg-slate-700 dark:text-slate-400'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Inputs row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search PO ref, material, supplier..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-10 h-9 w-full text-xs bg-white dark:bg-slate-950 border-slate-205 dark:border-slate-800 focus-visible:ring-indigo-500/20 rounded-xl shadow-sm"
            />
          </div>

          <SortSelect
            value={sortBy}
            onChange={handleSortChange}
            options={sortOptions}
            className="w-full sm:w-auto h-9 text-xs"
          />
        </div>
      </div>

      {/* Responsive Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : paginatedDeliveries.length === 0 ? (
        <div className="flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 py-20 shadow-sm">
          <div className="flex flex-col items-center gap-3 w-full text-center p-5">
            <div className="w-16 h-16 bg-slate-100/80 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-bold text-slate-805 dark:text-slate-100">
              {activeTab === 'upcoming' ? 'No upcoming deliveries found' : 'No delivered items found'}
            </h3>
            <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
              {activeTab === 'upcoming'
                ? 'POs marked as Approved but not yet received at the warehouse will be shown here.'
                : 'Received deliveries with active GRN records will be shown here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedDeliveries.map((d) => (
              <DeliveryCard 
                key={d.id} 
                d={d} 
                navigate={navigate} 
                onQRView={setQRDelivery} 
                canReceive={canReceive} 
                onMarkFullyDelivered={(item) => setMarkingDelivery(item)}
                onOpenGRNModal={(item) => setSelectedPOGRNs(item)}
              />
            ))}
          </div>
          
          {/* Pagination Controls Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl shadow-sm gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sorted.length)} of {sorted.length} deliveries
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>
            
            <div className="text-xs font-bold text-slate-800 dark:text-slate-250 bg-slate-100/50 dark:bg-slate-950 px-3 py-1 rounded-lg border border-slate-200/50 dark:border-slate-850 order-3">
              Total Listed Value: ₹{filtered.reduce((sum, d) => sum + (isNaN(Number(d.amount)) ? 0 : Number(d.amount)), 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
            </div>
          </div>
        </div>
      )}

      {/* QR Details Modal */}
      {qrDelivery && <QRDetailModal delivery={qrDelivery} onClose={() => setQRDelivery(null)} />}

      {/* Multi-GRN Shipments Modal */}
      {selectedPOGRNs && (
        <POGRNsListModal
          delivery={selectedPOGRNs}
          onClose={() => setSelectedPOGRNs(null)}
          onQRView={(grn) => {
            setQRDelivery({
              ...selectedPOGRNs,
              grnId: grn.id,
              referenceNo: grn.referenceNo || selectedPOGRNs.referenceNo,
              grnStatus: grn.status || selectedPOGRNs.grnStatus,
              actualReceivedQty: grn.receivedQty || selectedPOGRNs.totalReceivedQty,
              receivedDate: grn.receivedDate || selectedPOGRNs.receivedDate,
            });
          }}
        />
      )}

      {/* Modern In-App Confirmation Modal to Mark PO as Fully Delivered */}
      {markingDelivery && (
        <ConfirmFullyDeliveredModal
          delivery={markingDelivery}
          onClose={() => !isSubmittingMarkDone && setMarkingDelivery(null)}
          onConfirm={executeMarkFullyDelivered}
          isSubmitting={isSubmittingMarkDone}
        />
      )}
    </div>
  );
}

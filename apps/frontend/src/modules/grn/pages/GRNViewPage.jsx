import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import { 
  ArrowLeft, Package, Truck, FlaskConical, CheckCircle2, XCircle, 
  AlertTriangle, Clock, QrCode, ShieldCheck, Calendar, Tag, FileText, 
  Layers, Check, Sparkles, Building2, Boxes, ArrowUpRight, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRef } from 'react';
import QRCode from 'qrcode';

function QRDisplay({ text }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (text && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, text, { width: 120, margin: 1 }, err => {
        if (err) console.error(err);
      });
    }
  }, [text]);
  return (
    <div 
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', text);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700"
      title="Drag and drop this QR code onto the header Scan icon to track its lifecycle!"
    >
      <canvas ref={canvasRef} className="rounded-lg border border-slate-200 dark:border-slate-700" />
    </div>
  );
}

const GRN_STATUS_MAP = {
  PENDING_LAB: { label: 'Pending Lab', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', Icon: Clock },
  LAB_APPROVED: { label: 'Lab Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', Icon: CheckCircle2 },
  LAB_EXEMPT: { label: 'Lab Exempt (Direct Stock)', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', Icon: ShieldCheck },
  LAB_REJECTED: { label: 'Lab Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', Icon: XCircle },
  LAB_RESAMPLE: { label: 'Need Resample', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400', Icon: AlertTriangle },
};

import DashboardBackButton from '@/components/ui/DashboardBackButton';

export default function GRNViewPage() {
  const { grnId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';
  const [highlightActive, setHighlightActive] = useState(!!location.state?.highlight);

  useEffect(() => {
    if (highlightActive) {
      const timer = setTimeout(() => {
        setHighlightActive(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightActive]);

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-detail', grnId],
    queryFn: async () => { const res = await api.get(`/grn/receive/${grnId}`); return res.data; },
    enabled: !!grnId,
  });

  const isExempt = grn?.isExempt || (grn?.items && grn.items.length > 0 && grn.items.every(i => i.labTestRequired === false));
  const status = grn ? (isExempt ? GRN_STATUS_MAP.LAB_EXEMPT : (GRN_STATUS_MAP[grn.status] || GRN_STATUS_MAP.PENDING_LAB)) : null;

  // Multi-GRN Shipments for the same PO
  const allGrns = Array.isArray(grn?.allGrns) && grn.allGrns.length > 0 
    ? grn.allGrns 
    : (grn ? [grn] : []);

  // Chronological sorting (earliest received date first for Shipment 1, Shipment 2...)
  const sortedAllGrns = [...allGrns].sort((a, b) => new Date(a.receivedDate || a.createdAt || 0) - new Date(b.receivedDate || b.createdAt || 0));
  const currentShipmentIndex = sortedAllGrns.findIndex(g => g.id === grn?.id || g.referenceNo === grn?.referenceNo);
  const currentShipmentNum = currentShipmentIndex >= 0 ? currentShipmentIndex + 1 : 1;

  const totalOrderedForPO = Number(grn?.po?.totalOrderedQty || grn?.po?.quantity || 0);
  const totalReceivedAcrossAll = allGrns.reduce((sum, g) => {
    const gQty = g.totalReceivedQty != null 
      ? Number(g.totalReceivedQty) 
      : (Array.isArray(g.items) ? g.items.reduce((s, it) => s + (Number(it.actualReceivedQty) || 0), 0) : 0);
    return sum + gQty;
  }, 0);
  const overallPct = totalOrderedForPO > 0 ? Math.min(100, Math.round((totalReceivedAcrossAll / totalOrderedForPO) * 100)) : 100;
  const totalPendingForPO = Math.max(0, totalOrderedForPO - totalReceivedAcrossAll);

  // Robust stock extractor: handles netQty, receivedQty, string Decimals, nulls, undefined
  const getBatchStock = (b) => {
    if (!b) return 0;
    const raw = (b.netQty !== null && b.netQty !== undefined)
      ? b.netQty 
      : ((b.receivedQty !== null && b.receivedQty !== undefined) ? b.receivedQty : b.quantity);
    const num = Number(raw);
    return !isNaN(num) ? num : 0;
  };

  // Robust UOM resolver: prioritizes line item's respective UOM from PO/GRN items
  const getBatchUom = (b) => {
    if (!b) return '';

    // 1. Prioritize line item in grn.po?.items
    if (Array.isArray(grn?.po?.items)) {
      const item = grn.po.items.find(i => 
        (i.rmId && (i.rmId === b.rawMaterialId || i.rmId === b.batchNumber)) ||
        (i.code && (i.code === b.rawMaterialId || i.code === b.batchNumber)) ||
        (i.id && (i.id === b.rawMaterialId || i.id === b.id)) ||
        (i.name && b.rawMaterialName && i.name.trim().toLowerCase() === b.rawMaterialName.trim().toLowerCase())
      );
      if (item?.uomLabel) return item.uomLabel;
      if (item?.uom) return typeof item.uom === 'object' ? (item.uom.abbreviation || item.uom.name) : item.uom;
      if (item?.unit) return item.unit;
    }

    // 2. Match in grn?.items
    if (Array.isArray(grn?.items)) {
      const grnItem = grn.items.find(i => 
        (i.rmId && (i.rmId === b.rawMaterialId || i.rmId === b.batchNumber)) ||
        (i.rmName && b.rawMaterialName && i.rmName.trim().toLowerCase() === b.rawMaterialName.trim().toLowerCase())
      );
      if (grnItem?.uomLabel) return grnItem.uomLabel;
      if (grnItem?.uom) return typeof grnItem.uom === 'object' ? (grnItem.uom.abbreviation || grnItem.uom.name) : grnItem.uom;
      if (grnItem?.unit) return grnItem.unit;
    }

    // 3. Match batch UOM if explicitly populated
    if (b.uom?.abbreviation) return b.uom.abbreviation;
    if (b.uom?.name) return b.uom.name;
    if (typeof b.uom === 'string' && b.uom.trim()) return b.uom;

    return grn?.po?.uom?.abbreviation || grn?.po?.uom?.name || '';
  };

  const handleViewInStock = (b) => {
    const rawMatCode = b.rawMaterialId || grn?.po?.rmId || '';
    const rawMatName = b.rawMaterialName || grn?.po?.name || '';
    const batchNum = b.batchNumber;
    navigate(
      `/rm/stock?code=${encodeURIComponent(rawMatCode)}&name=${encodeURIComponent(rawMatName)}&materialId=${encodeURIComponent(rawMatCode)}&openHistory=true${batchNum ? `&batch=${encodeURIComponent(batchNum)}` : ''}`,
      {
        state: {
          materialId: rawMatCode,
          rmCode: rawMatCode,
          rmName: rawMatName,
          batchNumber: batchNum,
          openHistory: true,
          initialTab: 'grn'
        }
      }
    );
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 sm:space-y-6 mx-auto transition-all duration-300">
      <DashboardBackButton defaultBack="/grn/list" />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">GRN Details</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Goods Received Note — full delivery record</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : !grn ? (
        <div className="text-center py-16 text-slate-400">GRN not found.</div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Multi-Shipment Switcher Bar (Appears when PO has multiple GRNs) */}
          {sortedAllGrns.length > 1 && (
            <div className="bg-gradient-to-r from-indigo-50/90 via-white to-purple-50/90 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Shipments & GRN Receipts for {grn.po?.referenceNo || 'PO'}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {sortedAllGrns.length} Shipments Logged
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      This purchase order was fulfilled across multiple installments. Click any shipment below to inspect its receipt record.
                    </p>
                  </div>
                </div>

                {/* Overall PO Progress Badge */}
                <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0 self-start sm:self-auto">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">PO Fulfillment:</span>
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white">
                    {totalReceivedAcrossAll.toLocaleString()} / {totalOrderedForPO.toLocaleString()} {grn.po?.uom?.abbreviation || ''}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                    {overallPct}%
                  </span>
                </div>
              </div>

              {/* Shipment Selector Tabs / Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                {sortedAllGrns.map((sGrn, idx) => {
                  const isCurrent = sGrn.id === grn.id || sGrn.referenceNo === grn.referenceNo;
                  const sQty = sGrn.totalReceivedQty || sGrn.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
                  const sItems = sGrn.items || [];
                  const sExempt = sGrn.isExempt || (sItems.length > 0 && sItems.every(i => i.labTestRequired === false));
                  const sLabCfg = sExempt ? GRN_STATUS_MAP.LAB_EXEMPT : (GRN_STATUS_MAP[sGrn.status] || GRN_STATUS_MAP.PENDING_LAB);

                  return (
                    <button
                      key={sGrn.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent) navigate(`/grn/view/${sGrn.id}`);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                          : 'bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-600" />
                      )}
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className={`font-mono text-xs font-bold ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {sGrn.referenceNo}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Shipment #{idx + 1}
                        </span>
                      </div>
                      
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>{sGrn.receivedDate ? format(new Date(sGrn.receivedDate), 'dd MMM yyyy') : '—'}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                          {sQty} {grn.po?.uom?.abbreviation || ''}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <span className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                          sGrn.status === 'LAB_APPROVED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                          sGrn.status === 'LAB_REJECTED' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                          {sGrn.status === 'LAB_APPROVED' ? '✓ Approved' : sGrn.status === 'LAB_REJECTED' ? '✕ Rejected' : '⏳ Pending Lab'}
                        </span>
                        {isCurrent ? (
                          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">
                            ● Active View
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            Switch →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className={`lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 transition-all duration-1000 ${highlightActive ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-50/10 dark:bg-indigo-950/15 animate-pulse' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" /> GRN Information
                </h3>
                {status && (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border w-fit ${status.cls}`}>
                    <status.Icon className="w-3 h-3" /> {status.label}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">GRN Reference</span><span className="font-mono font-bold text-violet-600 dark:text-violet-400 text-sm sm:text-base">{grn.referenceNo}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">PO Reference</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm sm:text-base">{grn.po?.referenceNo}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Material</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.po?.name}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">RM ID</span><span className="font-mono text-slate-700 dark:text-slate-300">{grn.po?.rmId}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Supplier</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.po?.supplier?.name || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Received By</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.receiver?.name || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Received Date</span><span className="font-medium text-slate-900 dark:text-slate-100">{grn.receivedDate ? format(new Date(grn.receivedDate), 'dd MMM yyyy HH:mm') : '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Amount Paid</span><span className="font-bold text-emerald-600 dark:text-emerald-400">₹{Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-slate-500 block mb-0.5 text-xs sm:text-sm">Refund Amount</span><span className="font-medium text-slate-900 dark:text-slate-100">₹{Number(grn.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
              {grn.discrepancyNotes && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>Discrepancy:</strong> {grn.discrepancyNotes}</span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col items-center gap-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 self-start">
                <QrCode className="w-5 h-5 text-indigo-500" /> QR Code
              </h3>
              <QRDisplay text={`GRN:${grn.referenceNo}|PO:${grn.po?.referenceNo}|ID:${grn.id}`} />
              <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{grn.referenceNo}</p>
            </div>
          </div>

          {/* Logistics, Transport & Invoice Information Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Truck className="w-5 h-5 text-indigo-500" /> Transport, Logistics & Supplier Invoice
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Vehicle Number</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {grn.vehicleNumber || grn.po?.vehicleNumber || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Transporter</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {grn.transporterName || grn.po?.transporterName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Transport Mode</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {grn.transportMode === 'ROAD' ? '🚛 Road Transport' :
                   grn.transportMode === 'RAIL' ? '🚆 Rail Freight' :
                   grn.transportMode === 'AIR' ? '✈️ Air Cargo' :
                   grn.transportMode === 'SHIP' ? '🚢 Maritime' : (grn.transportMode || '🚛 Road')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">LR / E-Way Bill No</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {grn.lrNumber || grn.po?.ewayBillNo || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Supplier Invoice No</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {grn.invoiceNumber || grn.po?.supplierInvoiceNo || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Supplier Invoice Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {(grn.invoiceDate || grn.po?.supplierInvoiceDate) ? format(new Date(grn.invoiceDate || grn.po?.supplierInvoiceDate), 'dd MMM yyyy') : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Driver / Carrier Contact</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {grn.driverName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-xs">Quality Clearance</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {isExempt ? '🛡️ Lab Exempt' : '🔬 Lab Inspection Required'}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" /> Received Items
              </h3>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Item & RM ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Batch / Lot #</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Expected</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Actual Recv</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Variance</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Rejected / Returned</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Inspection</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Lab Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {grn.items?.map(item => {
                    const expected = Number(item.expectedQty || 0);
                    const received = Number(item.actualReceivedQty || 0);
                    const rejected = Number(item.rejectedQty || item.returnQty || 0);
                    const variance = received - expected;
                    const itemExempt = item.labTestRequired === false;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.rmName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{item.rmId}</div>
                        </td>
                        <td className="px-4 py-3">
                          {item.batchNumber ? (
                            <div>
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded text-[11px]">
                                {item.batchNumber}
                              </span>
                              {item.mfgDate && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Mfg: {format(new Date(item.mfgDate), 'dd/MM/yyyy')}
                                </div>
                              )}
                              {item.expiryDate && (
                                <div className="text-[10px] text-rose-500 mt-0.5">
                                  Exp: {format(new Date(item.expiryDate), 'dd/MM/yyyy')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 font-medium">
                          {expected.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                          {received.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {variance < 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded text-[10px]">
                              Short: {variance.toFixed(2)}
                            </span>
                          ) : variance > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded text-[10px]">
                              +{variance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              Exact
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {rejected > 0 ? (
                            <div>
                              <span className="font-bold text-rose-600">{rejected.toLocaleString()}</span>
                              {item.rejectionReason && (
                                <div className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-[120px]" title={item.rejectionReason}>
                                  {item.rejectionReason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.inspectionStatus === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                              : item.inspectionStatus === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                          }`}>
                            {item.inspectionStatus || 'ACCEPTED'}
                          </span>
                          {item.coaRequired && (
                            <div className="text-[9px] font-mono text-indigo-500 mt-0.5">
                              COA: {item.coaNumber || 'Attached'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {itemExempt ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200">
                              <ShieldCheck className="w-3 h-3 text-red-600" /> Lab Exempt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200">
                              <FlaskConical className="w-3 h-3 text-violet-500" /> Lab Required
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {grn.items?.map(item => {
                const net = Number(item.actualReceivedQty) - Number(item.returnQty || 0);
                return (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block text-sm">{item.rmName}</span>
                        <span className="font-mono text-xs text-slate-500 block mt-0.5">RM ID: {item.rmId}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Net Recv</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{net.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Expected</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{Number(item.expectedQty).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Actual Recv</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{Number(item.actualReceivedQty).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Returned</span>
                        <span className="font-semibold text-red-500">{Number(item.returnQty || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lab Test Results */}
          {grn.labTest && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-violet-500" /> Lab Test Results
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${grn.labTest.status === 'IN_PROGRESS' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700' : grn.labTest.overallDecision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200' : grn.labTest.overallDecision === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                  {grn.labTest.status === 'IN_PROGRESS' ? 'DRAFT' : grn.labTest.overallDecision}
                </span>
              </div>
              {grn.labTest.status === 'IN_PROGRESS' && (
                <div className="px-4 sm:px-6 py-3 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-405" />
                  <span><strong>Draft Saved:</strong> These test results are in draft mode and have not been finalized. Material stock has NOT been updated yet.</span>
                </div>
              )}
              {grn.labTest.labNotes && (
                <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/30 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-medium">Lab Notes: </span>{grn.labTest.labNotes}
                </div>
              )}

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Material</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Expiry Date</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Test Notes</th>
                      <th className="px-6 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {grn.labTest.testResults?.map(tr => (
                      <tr key={tr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                          <div>{tr.rmName}</div>
                          {tr.needTesting === false ? (
                            <span className="inline-block mt-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">No Testing Required</span>
                          ) : (
                            tr.categoryParams && Object.keys(tr.categoryParams).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-md">
                                {Object.entries(tr.categoryParams).map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center bg-violet-50/70 dark:bg-violet-950/45 text-violet-750 dark:text-violet-300 text-[10px] px-1.5 py-0.5 rounded-md border border-violet-100 dark:border-violet-900/30">
                                    <strong className="font-semibold mr-1">{k}:</strong> {v}
                                  </span>
                                ))}
                              </div>
                            )
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '-'}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{tr.testNotes || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          {tr.needTesting === false ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-505 dark:bg-slate-800 dark:text-slate-400"><CheckCircle2 className="w-3 h-3 text-slate-400" />Exempt</span>
                          ) : tr.passed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Pass</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"><XCircle className="w-3 h-3" />Fail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {grn.labTest.testResults?.map(tr => (
                  <div key={tr.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{tr.rmName}</span>
                        {tr.needTesting === false ? (
                          <span className="block mt-1 w-fit text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">No Testing Required</span>
                        ) : (
                          tr.categoryParams && Object.keys(tr.categoryParams).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {Object.entries(tr.categoryParams).map(([k, v]) => (
                                <span key={k} className="inline-block bg-violet-50/70 dark:bg-violet-950/45 text-violet-750 dark:text-violet-300 text-[9px] px-1 py-0.5 rounded border border-violet-100/50 dark:border-violet-900/10">
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                      {tr.needTesting === false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-505 dark:bg-slate-800 dark:text-slate-400"><CheckCircle2 className="w-3 h-3 text-slate-400" />Exempt</span>
                      ) : tr.passed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Pass</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"><XCircle className="w-3.5 h-3.5" />Fail</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Expiry Date</span>
                        <span className="text-slate-800 dark:text-slate-200">{tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Test Notes</span>
                        <span className="text-slate-600 dark:text-slate-400">{tr.testNotes || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {grn.labTest.categoryParams && Object.keys(grn.labTest.categoryParams).length > 0 && (
                <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Test Parameters</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Object.entries(grn.labTest.categoryParams).map(([key, value]) => (
                      <div key={key} className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{key}</span>
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inventory Batches Created */}
          {Array.isArray(grn.inventoryBatches) && grn.inventoryBatches.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-500" /> Active Inventory Batches
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200">
                  {grn.inventoryBatches.length} Batches In Stock
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {grn.inventoryBatches.map(b => {
                  const stock = getBatchStock(b);
                  const uom = getBatchUom(b);

                  return (
                    <div key={b.id} className="p-4 sm:px-6 flex items-center justify-between flex-wrap gap-4 text-xs sm:text-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => navigate(`/qr-lifecycle/${encodeURIComponent(b.batchNumber)}`)}
                            className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm sm:text-base hover:underline inline-flex items-center gap-1 group text-left cursor-pointer"
                            title="Open Batch QR & Traceability"
                          >
                            <span>{b.batchNumber}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            🟢 {b.status || 'AVAILABLE'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>Material: <strong className="text-slate-700 dark:text-slate-300">{b.rawMaterialName}</strong></span>
                          {b.rawMaterialId && <span className="font-mono text-[11px] text-slate-400">({b.rawMaterialId})</span>}
                          {b.mfgDate && <span>· Mfg: {format(new Date(b.mfgDate), 'dd/MM/yyyy')}</span>}
                          {b.expiryDate && <span>· Exp: {format(new Date(b.expiryDate), 'dd/MM/yyyy')}</span>}
                          {b.storageLocation && <span>· Loc: <strong className="text-slate-600 dark:text-slate-400">{b.storageLocation}</strong></span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block font-medium">Net Stock Stored</span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg font-mono">
                            {stock.toLocaleString()} <span className="text-xs font-semibold text-slate-500 uppercase">{uom}</span>
                          </span>
                          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center justify-end gap-1">
                            <Check className="w-3 h-3" /> In Stock
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1 font-medium"
                            onClick={() => navigate(`/qr-lifecycle/${encodeURIComponent(b.batchNumber)}`)}
                            title="Trace QR Lifecycle"
                          >
                            <QrCode className="w-3.5 h-3.5" /> Trace QR
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1 font-medium"
                            onClick={() => handleViewInStock(b)}
                            title="View Material Stock"
                          >
                            <Boxes className="w-3.5 h-3.5" /> RM Stock
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multi-GRN Shipments Audit Section for this PO */}
          {sortedAllGrns.length > 1 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      All Shipments for {grn.po?.referenceNo || 'PO'}
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                        {sortedAllGrns.length} GRN Receipts
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Overall PO Fulfillment: <strong className="text-slate-700 dark:text-slate-300 font-mono">{totalReceivedAcrossAll.toLocaleString()}</strong> of <strong className="text-slate-700 dark:text-slate-300 font-mono">{totalOrderedForPO.toLocaleString()} {grn.po?.uom?.abbreviation || ''}</strong> ({overallPct}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Pending Balance:</span>
                  <span className={`font-mono font-bold ${totalPendingForPO === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {totalPendingForPO === 0 ? '0 pending (Fully Delivered)' : `${totalPendingForPO.toLocaleString()} ${grn.po?.uom?.abbreviation || ''} pending`}
                  </span>
                </div>
              </div>

              {/* Table of all shipments */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/70 dark:bg-slate-800/60 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Shipment</th>
                      <th className="px-4 py-2.5 text-left">GRN Reference</th>
                      <th className="px-4 py-2.5 text-left">Received Date</th>
                      <th className="px-4 py-2.5 text-left">Received By</th>
                      <th className="px-4 py-2.5 text-left">Delivered Items</th>
                      <th className="px-4 py-2.5 text-right">Received Qty</th>
                      <th className="px-4 py-2.5 text-center">Lab Status</th>
                      <th className="px-4 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedAllGrns.map((sGrn, sIdx) => {
                      const isCurrent = sGrn.id === grn.id || sGrn.referenceNo === grn.referenceNo;
                      const sQty = sGrn.totalReceivedQty || sGrn.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
                      const sItems = sGrn.items || [];
                      const sExempt = sGrn.isExempt || (sItems.length > 0 && sItems.every(i => i.labTestRequired === false));
                      const sLabCfg = sExempt ? GRN_STATUS_MAP.LAB_EXEMPT : (GRN_STATUS_MAP[sGrn.status] || GRN_STATUS_MAP.PENDING_LAB);

                      return (
                        <tr 
                          key={sGrn.id}
                          className={`transition-colors ${
                            isCurrent 
                              ? 'bg-indigo-50/40 dark:bg-indigo-950/20 font-medium' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Shipment #{sIdx + 1}
                            </span>
                            {isCurrent && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">
                                Current
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {sGrn.referenceNo}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {sGrn.receivedDate ? format(new Date(sGrn.receivedDate), 'dd MMM yyyy, HH:mm') : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {sGrn.receiver?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[220px]">
                            {sItems.length > 0 ? (
                              <div className="truncate" title={sItems.map(i => `${i.actualReceivedQty} ${i.rmName}`).join(', ')}>
                                {sItems.map(i => `${i.actualReceivedQty} ${i.rmName}`).join(', ')}
                              </div>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {sQty.toLocaleString()} {grn.po?.uom?.abbreviation || ''}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sLabCfg.cls}`}>
                              <sLabCfg.Icon className="w-3 h-3" /> {sLabCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {isCurrent ? (
                              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                Active View
                              </span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/grn/view/${sGrn.id}`)}
                                className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                View GRN →
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action for lab test if pending */}
          {grn.status === 'PENDING_LAB' && (
            <div className="flex justify-end">
              <Button 
                onClick={() => navigate(`/lab/test/${grn.id}`)} 
                className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white gap-2 justify-center"
              >
                <FlaskConical className="w-4 h-4" /> 
                {grn.labTest ? 'Edit/Complete Lab Results' : 'Enter Lab Results'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

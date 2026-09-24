import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { 
  ArrowLeft, Loader2, QrCode, Package, Truck, AlertTriangle, 
  CheckCircle2, Send, FlaskConical, ShieldCheck, FileText, 
  Calendar, Layers, Check, X, Info, Tag, Sparkles, Building2,
  ChevronDown, ChevronUp, AlertCircle, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

function QRDisplay({ text, onDragStart }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (text && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, text, { width: 160, margin: 1 }, err => {
        if (err) console.error(err);
      });
    }
  }, [text]);
  return (
    <div 
      draggable="true" 
      onDragStart={onDragStart}
      className="cursor-grab active:cursor-grabbing p-1 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all group relative flex items-center justify-center"
    >
      <canvas ref={canvasRef} className="rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm" />
      <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity pointer-events-none">
        <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-md font-semibold shadow-sm animate-bounce">Drag QR Code</span>
      </div>
    </div>
  );
}

// Date parser helper to reliably format date strings for input[type="date"]
const toInputDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  if (typeof val === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(val)) {
    const [d, m, y] = val.split('-');
    return `${y}-${m}-${d}`;
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  } catch {}
  return '';
};

export default function ReceiveDeliveryPage() {
  const { poId } = useParams();
  const navigate = useNavigate();

  // Logistics & Transport state prefilled from PO
  const [transportForm, setTransportForm] = useState({
    vehicleNumber: '',
    transporterName: '',
    transportMode: 'ROAD',
    lrNumber: '',
    driverName: '',
    invoiceNumber: '',
    invoiceDate: '',
  });

  // Receipt & Financial state
  const [receiptForm, setReceiptForm] = useState({
    receivedDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    amountPaid: '',
    refundAmount: '0',
    discrepancyNotes: '',
  });

  const [items, setItems] = useState([]);
  const [isFinalDelivery, setIsFinalDelivery] = useState(false);
  const [error, setError] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  const { data: po, isLoading } = useQuery({
    queryKey: ['po-detail', poId],
    queryFn: async () => { 
      const res = await api.get(`/rm/po/${poId}`); 
      return res.data; 
    },
    enabled: !!poId,
  });

  // Populate form fields from PO and auto-fetch sequential batch numbers
  useEffect(() => {
    if (!po) return;

    // Prefill logistics & transport details from PO
    setTransportForm({
      vehicleNumber: po.vehicleNumber || '',
      transporterName: po.transporterName || '',
      transportMode: po.transportMode || 'ROAD',
      lrNumber: po.ewayBillNo || po.lrNumber || '',
      driverName: po.driverName || '',
      invoiceNumber: po.supplierInvoiceNo || '',
      invoiceDate: po.supplierInvoiceDate ? toInputDate(po.supplierInvoiceDate) : '',
    });

    // Prefill financial details
    const poTotal = po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount;
    setReceiptForm(prev => ({
      ...prev,
      amountPaid: String(poTotal || 0)
    }));

    const getInitBatch = (name) => {
      const clean = (name || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      return `BATCH-${clean || 'RM'}-001`;
    };

    // Calculate previous receipts per raw material from all existing GRNs
    const previousGrns = po.grnReceives || [];

    let rawItems = [];
    if (po.items && Array.isArray(po.items) && po.items.length > 0) {
      rawItems = po.items.map(it => {
        const itemIdentifier = it.rmId || it.code || it.id;
        const totalOrderedQty = Number(it.quantity || 0);

        // Sum previous received qty for this item across prior GRNs
        const prevReceivedQty = previousGrns.reduce((sum, g) => {
          const match = g.items?.find(gi => gi.rmId === itemIdentifier || gi.rmName === it.name);
          return sum + (Number(match?.actualReceivedQty) || 0);
        }, 0);

        const remainingPendingQty = Math.max(0, totalOrderedQty - prevReceivedQty);

        // Extract official PO batch information
        const firstSubBatch = it.batches && Array.isArray(it.batches) && it.batches.length > 0 ? it.batches[0] : null;
        const officialBatchNo = firstSubBatch?.batchNo || it.mfgBatchNo || it.batchNo || po.mfgBatchNo;
        const hasOfficialBatch = Boolean(officialBatchNo && officialBatchNo.trim() !== '');

        const officialMfgDate = toInputDate(firstSubBatch?.mfgDate || it.mfgDate || po.mfgDate);
        const officialExpDate = toInputDate(firstSubBatch?.expDate || it.expDate || po.expDate);
        const officialWeight = firstSubBatch?.weight || it.weight || '';

        return {
          rmId: itemIdentifier,
          rmName: it.name,
          totalOrderedQty,
          prevReceivedQty,
          remainingPendingQty,
          expectedQty: remainingPendingQty > 0 ? remainingPendingQty : totalOrderedQty,
          actualReceivedQty: remainingPendingQty > 0 ? remainingPendingQty : totalOrderedQty,
          returnQty: 0,
          batchNumber: hasOfficialBatch ? officialBatchNo.trim().toUpperCase() : getInitBatch(it.name),
          isBatchLocked: hasOfficialBatch, // Lock batch if provided on PO!
          mfgDate: officialMfgDate || format(new Date(), 'yyyy-MM-dd'),
          expiryDate: officialExpDate || '',
          weight: officialWeight,
          batches: it.batches || [],
          inspectionStatus: 'ACCEPTED',
          coaRequired: false,
          coaNumber: '',
          rejectedQty: 0,
          rejectionReason: '',
          labTestRequired: it.labTestRequired !== false,
          uomLabel: it.uomLabel || it.uom || po.uom?.abbreviation || 'units',
        };
      });
    } else {
      const totalOrderedQty = Number(po.quantity || 0);
      const prevReceivedQty = previousGrns.reduce((sum, g) => {
        return sum + (g.items?.reduce((s, it) => s + (Number(it.actualReceivedQty) || 0), 0) || 0);
      }, 0);
      const remainingPendingQty = Math.max(0, totalOrderedQty - prevReceivedQty);

      const hasOfficialBatch = Boolean(po.mfgBatchNo && po.mfgBatchNo.trim() !== '');

      rawItems = [{
        rmId: po.rmId,
        rmName: po.name,
        totalOrderedQty,
        prevReceivedQty,
        remainingPendingQty,
        expectedQty: remainingPendingQty > 0 ? remainingPendingQty : totalOrderedQty,
        actualReceivedQty: remainingPendingQty > 0 ? remainingPendingQty : totalOrderedQty,
        returnQty: 0,
        batchNumber: hasOfficialBatch ? po.mfgBatchNo.trim().toUpperCase() : getInitBatch(po.name),
        isBatchLocked: hasOfficialBatch,
        mfgDate: toInputDate(po.mfgDate) || format(new Date(), 'yyyy-MM-dd'),
        expiryDate: toInputDate(po.expDate) || '',
        weight: po.weight || '',
        batches: [],
        inspectionStatus: 'ACCEPTED',
        coaRequired: false,
        coaNumber: '',
        rejectedQty: 0,
        rejectionReason: '',
        labTestRequired: true,
        uomLabel: po.uom?.abbreviation || 'units',
      }];
    }

    setItems(rawItems);

    // Auto-mark final delivery if this delivery fulfills all remaining pending
    const totalRemaining = rawItems.reduce((s, i) => s + i.remainingPendingQty, 0);
    const totalReceivingNow = rawItems.reduce((s, i) => s + i.actualReceivedQty, 0);
    setIsFinalDelivery(totalReceivingNow >= totalRemaining);

    // Auto-fetch server sequential batch numbers ONLY for items that DO NOT have an official PO batch
    rawItems.forEach(async (item, idx) => {
      if (item.isBatchLocked) return; // Do not overwrite PO batch!
      try {
        const res = await api.get(`/grn/next-batch/${encodeURIComponent(item.rmId)}?rmName=${encodeURIComponent(item.rmName)}`);
        const generated = res.data?.batchNumber || res.data?.nextBatchNumber;
        if (generated) {
          setItems(prev => prev.map((it, i) => i === idx && !it.isBatchLocked ? { ...it, batchNumber: generated } : it));
        }
      } catch (e) {
        console.warn('Auto batch fetch fallback used for', item.rmName);
      }
    });

  }, [po]);

  const mutation = useMutation({
    mutationFn: async (payload) => { 
      const res = await api.post('/grn/receive', payload); 
      return res.data; 
    },
    onSuccess: (data) => { 
      setSubmittedData(data); 
    },
    onError: (err) => { 
      setError(err.response?.data?.error || 'Failed to submit GRN. Please check the entered values.'); 
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!po) return;

    // Validate that actual received qty is provided
    for (const it of items) {
      if (it.actualReceivedQty < 0 || isNaN(it.actualReceivedQty)) {
        setError(`Please enter a valid received quantity for ${it.rmName}`);
        return;
      }
      if (!it.batchNumber?.trim()) {
        setError(`Batch / Lot number is required for ${it.rmName}`);
        return;
      }
    }

    const payload = {
      poId: po.id,
      receivedDate: new Date(receiptForm.receivedDate).toISOString(),
      isFinalDelivery: Boolean(isFinalDelivery),
      deliveryType: isFinalDelivery ? 'FINAL' : 'PARTIAL',
      amountPaid: Number(receiptForm.amountPaid) || 0,
      refundAmount: Number(receiptForm.refundAmount) || 0,
      discrepancyNotes: receiptForm.discrepancyNotes || undefined,

      // Transport details
      vehicleNumber: transportForm.vehicleNumber?.trim() || null,
      transporterName: transportForm.transporterName?.trim() || null,
      transportMode: transportForm.transportMode || 'ROAD',
      lrNumber: transportForm.lrNumber?.trim() || null,
      driverName: transportForm.driverName?.trim() || null,
      invoiceNumber: transportForm.invoiceNumber?.trim() || null,
      invoiceDate: transportForm.invoiceDate ? new Date(transportForm.invoiceDate).toISOString() : null,

      // Items list
      items: items.map(it => ({
        rmId: it.rmId,
        rmName: it.rmName,
        expectedQty: Number(it.expectedQty),
        actualReceivedQty: Number(it.actualReceivedQty),
        returnQty: Number(it.rejectedQty || it.returnQty || 0),
        batchNumber: it.batchNumber?.trim(),
        mfgDate: it.mfgDate ? new Date(it.mfgDate).toISOString() : null,
        expiryDate: it.expiryDate ? new Date(it.expiryDate).toISOString() : null,
        weight: it.weight || null,
        batches: it.batches || [],
        inspectionStatus: it.inspectionStatus || 'ACCEPTED',
        coaRequired: Boolean(it.coaRequired),
        coaNumber: it.coaNumber?.trim() || null,
        rejectedQty: Number(it.rejectedQty || 0),
        rejectionReason: it.rejectionReason?.trim() || null,
        labTestRequired: it.labTestRequired !== false,
      })),
    };

    mutation.mutate(payload);
  };

  const updateItem = (idx, field, val) => {
    setItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, [field]: val } : it);
      if (field === 'actualReceivedQty') {
        const totalRemaining = next.reduce((s, i) => s + (i.remainingPendingQty || i.expectedQty || 0), 0);
        const totalReceivingNow = next.reduce((s, i) => s + (Number(i.actualReceivedQty) || 0), 0);
        setIsFinalDelivery(totalReceivingNow >= totalRemaining);
      }
      return next;
    });
  };

  const handleGenerateBatch = async (idx) => {
    const item = items[idx];
    if (!item || item.isBatchLocked) return;
    try {
      const res = await api.get(`/grn/next-batch/${encodeURIComponent(item.rmId)}?rmName=${encodeURIComponent(item.rmName)}`);
      const generated = res.data?.batchNumber || res.data?.nextBatchNumber;
      if (generated) {
        updateItem(idx, 'batchNumber', generated);
      }
    } catch (e) {
      const clean = (item.rmName || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      updateItem(idx, 'batchNumber', `BATCH-${clean || 'RM'}-001`);
    }
  };

  const totalExpected = items.reduce((s, i) => s + (Number(i.expectedQty) || 0), 0);
  const totalActual = items.reduce((s, i) => s + (Number(i.actualReceivedQty) || 0), 0);
  const totalRejected = items.reduce((s, i) => s + (Number(i.rejectedQty) || 0), 0);
  const netAccepted = Math.max(0, totalActual - totalRejected);
  const totalDiff = totalActual - totalExpected;
  const hasDiscrepancy = Math.abs(totalDiff) > 0.001 || totalRejected > 0;
  const allItemsExempt = items.length > 0 && items.every(it => it.labTestRequired === false);
  const previousDeliveries = po?.grnReceives || [];

  // ──────────────────────────────────────────────────────────────────────────
  // Success Confirmation Screen
  // ──────────────────────────────────────────────────────────────────────────
  if (submittedData) {
    const isExempt = submittedData.isExempt;
    return (
      <div className="p-6 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${
          isExempt 
            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-50 dark:ring-emerald-950/40' 
            : 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 ring-8 ring-violet-50 dark:ring-violet-950/40'
        }`}>
          {isExempt ? <ShieldCheck className="w-12 h-12" /> : <FlaskConical className="w-12 h-12" />}
        </div>

        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1" style={{
            backgroundColor: isExempt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            color: isExempt ? '#059669' : '#7c3aed'
          }}>
            {isExempt ? '🛡️ Lab Test Exempt · Direct Inventory' : '🔬 Lab Test Required · Queued'}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            GRN {submittedData.referenceNo || 'Submitted'} Received Successfully
          </h2>

          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            {isExempt ? (
              <span>
                All received items are marked as <strong>Lab Test Exempt</strong>. Material stock balances have been <strong>directly incremented in the raw material inventory</strong> and sequential batch tracking records have been generated.
              </span>
            ) : (
              <span>
                Delivery details, transport documentation, and batch numbers have been recorded. Items requiring quality clearance have been placed in <strong>quarantine and routed to the Laboratory testing queue</strong>.
              </span>
            )}
          </p>
        </div>

        {/* Batch summary card */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 text-left shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Assigned Batches & Quantities
          </h4>
          <div className="space-y-2.5">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs sm:text-sm">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{it.rmName}</span>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>Batch: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{it.batchNumber}</strong></span>
                    <span>·</span>
                    <span>Status: {it.inspectionStatus}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{it.actualReceivedQty} {it.uomLabel}</span>
                  <div className="text-[11px]">
                    {it.labTestRequired ? (
                      <span className="text-violet-600 dark:text-violet-400 font-semibold">🔬 Pending Lab</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-semibold">🛡️ Stock Updated (Exempt)</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => navigate('/grn/upcoming')}>
            Back to Deliveries
          </Button>
          <Button variant="outline" onClick={() => navigate('/grn/list')}>
            View GRN Register
          </Button>
          {!isExempt ? (
            <Button onClick={() => navigate('/lab/pending')} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Go to Lab Testing Queue
            </Button>
          ) : (
            <Button onClick={() => navigate('/rm/stock')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              View RM Stock
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Main Receive Form
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grn/upcoming')} className="rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Receive Delivery & Inspection</h1>
            {allItemsExempt && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200">
                <ShieldCheck className="w-3.5 h-3.5 text-red-600" /> All Items Lab-Exempt (Direct to Stock)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Verify shipment quantities, record transport documents, assign batch numbers, and route to inventory or lab.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : !po ? (
        <div className="text-center py-16 text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">Purchase Order not found</p>
          <Button onClick={() => navigate('/grn/upcoming')} variant="outline" className="mt-4">
            Return to Upcoming Deliveries
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Top Section: PO Details + Transport Prefills + QR Code */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Purchase Order Summary */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" /> Purchase Order Overview
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {po.referenceNo}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500 block text-xs">Supplier</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{po.supplier?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Primary Material</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{po.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Expected Delivery</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {po.expectedDelivery ? format(new Date(po.expectedDelivery), 'dd MMM yyyy') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Total Quantity</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {Number(po.quantity).toLocaleString()} {po.uom?.abbreviation || ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Order Value</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                    ₹{Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Order Status</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ● {po.status}
                  </span>
                </div>
              </div>

              {/* Logistics Prefill Info Strip */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 border border-slate-200/80 dark:border-slate-700/60 text-xs flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  <span>Logistics info automatically loaded from PO. You can review or edit below.</span>
                </div>
                {po.ewayBillNo && (
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    E-Way: {po.ewayBillNo}
                  </span>
                )}
              </div>
            </div>

            {/* QR Code Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 self-start">
                <QrCode className="w-5 h-5 text-indigo-500" /> Delivery QR Code
              </h3>
              <QRDisplay 
                text={`PO:${po.referenceNo}|ID:${po.id}|RM:${po.rmId}|${po.name}`} 
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', `PO:${po.referenceNo}|ID:${po.id}|RM:${po.rmId}|${po.name}`);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
              <p className="text-xs text-slate-400 text-center">Scan to verify purchase order details at loading bay</p>
              <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{po.referenceNo}</p>
            </div>
          </div>

          {/* Logistics & Transport Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              <Truck className="w-5 h-5 text-indigo-500" /> Transport, Logistics & Invoice Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Vehicle Number</Label>
                <Input 
                  placeholder="e.g. MH 12 AB 1234" 
                  value={transportForm.vehicleNumber} 
                  onChange={e => setTransportForm(p => ({ ...p, vehicleNumber: e.target.value.toUpperCase() }))}
                  className="font-mono uppercase text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Transporter / Carrier</Label>
                <Input 
                  placeholder="e.g. VRL Logistics / Delhivery" 
                  value={transportForm.transporterName} 
                  onChange={e => setTransportForm(p => ({ ...p, transporterName: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Transport Mode</Label>
                <select 
                  className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs focus:ring-2 focus:ring-indigo-500"
                  value={transportForm.transportMode}
                  onChange={e => setTransportForm(p => ({ ...p, transportMode: e.target.value }))}
                >
                  <option value="ROAD">🚛 Road Transport</option>
                  <option value="RAIL">🚆 Rail Freight</option>
                  <option value="AIR">✈️ Air Cargo</option>
                  <option value="SHIP">🚢 Maritime / Ship</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">LR / Challan / E-Way Bill No</Label>
                <Input 
                  placeholder="e.g. LR-98721 or 2410982348" 
                  value={transportForm.lrNumber} 
                  onChange={e => setTransportForm(p => ({ ...p, lrNumber: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Driver / Carrier Contact</Label>
                <Input 
                  placeholder="e.g. Ramesh Kumar (+91...)" 
                  value={transportForm.driverName} 
                  onChange={e => setTransportForm(p => ({ ...p, driverName: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Supplier Invoice No</Label>
                <Input 
                  placeholder="e.g. INV-2026-901" 
                  value={transportForm.invoiceNumber} 
                  onChange={e => setTransportForm(p => ({ ...p, invoiceNumber: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Supplier Invoice Date</Label>
                <Input 
                  type="date"
                  value={transportForm.invoiceDate} 
                  onChange={e => setTransportForm(p => ({ ...p, invoiceDate: e.target.value }))}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Multi-Shipment Delivery Status Card (if prior receipts exist) */}
          {previousDeliveries && previousDeliveries.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/60 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {previousDeliveries.length + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <span>Multi-Shipment Delivery in Progress</span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                        Shipment #{previousDeliveries.length + 1}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {previousDeliveries.length} prior {previousDeliveries.length === 1 ? 'receipt has' : 'receipts have'} been logged for this Purchase Order.
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 block">Total PO Ordered</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {items.reduce((s, i) => s + (i.totalOrderedQty || i.expectedQty || 0), 0)} {items[0]?.uomLabel || 'units'}
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 block">Previously Received & Stocked</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {items.reduce((s, i) => s + (i.prevReceivedQty || 0), 0)} {items[0]?.uomLabel || 'units'}
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 block">Remaining Pending</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {items.reduce((s, i) => s + (i.remainingPendingQty || 0), 0)} {items[0]?.uomLabel || 'units'}
                  </span>
                </div>
              </div>

              {/* Prior GRNs List */}
              <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Prior Receipt History
                </span>
                <div className="flex flex-wrap gap-2">
                  {previousDeliveries.map((g, gi) => {
                    const rcvQty = g.items?.reduce((s, it) => s + Number(it.actualReceivedQty || 0), 0) || 0;
                    return (
                      <div key={g.id || gi} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{g.referenceNo || `GRN-${gi+1}`}</span>
                        <span>•</span>
                        <span>{g.receivedDate ? format(new Date(g.receivedDate), 'dd MMM yyyy') : 'Received'}</span>
                        <span>•</span>
                        <span className="font-bold text-emerald-600">+{rcvQty} {items[0]?.uomLabel || ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Items Table & Batch / Quality Inspection Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" /> Material Receipt, Inspection & Batch Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official PO batch numbers are locked for traceability. Enter actual quantity received for this shipment.
                </p>
              </div>

              {hasDiscrepancy && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy / Rejection Logged
                </span>
              )}
            </div>

            {/* Per-Item Detailed Cards */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, idx) => {
                const diff = Number(item.actualReceivedQty) - Number(item.expectedQty);
                const itemNetAccepted = Math.max(0, Number(item.actualReceivedQty) - Number(item.rejectedQty || 0));

                return (
                  <div key={idx} className="p-5 sm:p-6 space-y-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                    
                    {/* Item Header Row */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                            {item.rmName}
                            <span className="font-mono text-xs font-normal text-slate-400">({item.rmId})</span>
                            {item.isBatchLocked && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                🔒 Locked to PO Batch
                              </span>
                            )}
                          </h4>
                          {item.totalOrderedQty > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              PO Ordered: <strong className="text-slate-700 dark:text-slate-300">{item.totalOrderedQty} {item.uomLabel}</strong>
                              {item.prevReceivedQty > 0 && (
                                <span> • Received Prior: <strong className="text-emerald-600">{item.prevReceivedQty} {item.uomLabel}</strong></span>
                              )}
                              {item.remainingPendingQty > 0 && (
                                <span> • Remaining: <strong className="text-amber-600">{item.remainingPendingQty} {item.uomLabel}</strong></span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Lab Status Badge */}
                      <div>
                        {item.labTestRequired ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                            <FlaskConical className="w-3.5 h-3.5 text-violet-500" /> Lab Test Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-red-600" /> Lab Exempt (Direct Inventory)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantities Grid & Shortage/Excess Tracker */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60 text-xs">
                      <div>
                        <span className="text-slate-500 block">Pending to Receive</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {item.expectedQty} {item.uomLabel}
                        </span>
                      </div>

                      <div>
                        <Label className="text-slate-600 dark:text-slate-300 text-xs block mb-1">
                          Actual Received Today *
                        </Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          value={item.actualReceivedQty} 
                          onChange={e => updateItem(idx, 'actualReceivedQty', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs font-bold text-slate-900 dark:text-white" 
                          required 
                        />
                      </div>

                      <div>
                        <span className="text-slate-500 block">Variance (Diff)</span>
                        <div className="mt-1">
                          {diff < 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                              <AlertCircle className="w-3 h-3" /> Shortage: {Math.abs(diff).toFixed(2)} {item.uomLabel}
                            </span>
                          ) : diff > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                              <Sparkles className="w-3 h-3" /> Excess: +{diff.toFixed(2)} {item.uomLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> Exact match
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block">Net Accepted</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                          {itemNetAccepted.toFixed(2)} {item.uomLabel}
                        </span>
                      </div>
                    </div>

                    {/* Batch Number & Inspection Details Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs pt-1">
                      {/* Sequential Batch Number */}
                      <div className="space-y-1.5 lg:col-span-2">
                        <Label className="text-xs font-medium flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            Batch / Lot Number *
                            {item.isBatchLocked && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">🔒 Locked to PO</span>
                            )}
                          </span>
                          {!item.isBatchLocked && (
                            <span className="text-[10px] text-indigo-500 font-normal">Auto-sequential per material</span>
                          )}
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input 
                            placeholder="e.g. BATCH-MILK-001" 
                            value={item.batchNumber} 
                            readOnly={item.isBatchLocked}
                            onChange={e => !item.isBatchLocked && updateItem(idx, 'batchNumber', e.target.value.toUpperCase())}
                            className={`font-mono font-bold text-xs uppercase flex-1 ${
                              item.isBatchLocked 
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-not-allowed border-slate-300 dark:border-slate-700' 
                                : ''
                            }`} 
                            required 
                          />
                          {!item.isBatchLocked && (
                            <button
                              type="button"
                              onClick={() => handleGenerateBatch(idx)}
                              className="h-9 px-2.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                              title="Auto-generate or refresh batch number"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Auto</span>
                            </button>
                          )}
                        </div>

                        {/* Multi-batch split breakdown if provided on PO */}
                        {item.batches && Array.isArray(item.batches) && item.batches.length > 1 && (
                          <div className="mt-1.5 space-y-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-200 dark:border-slate-700 text-[11px]">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">PO Batch Allocations:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.batches.map((b, bi) => (
                                <span key={bi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 font-mono text-[10px]">
                                  <strong>{b.batchNo}</strong>: {b.quantity} {item.uomLabel}
                                  {b.expDate && <span className="text-slate-400">· Exp: {b.expDate}</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Manufacturing Date */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Mfg Date</Label>
                        <Input 
                          type="date"
                          value={item.mfgDate} 
                          onChange={e => updateItem(idx, 'mfgDate', e.target.value)}
                          className="text-xs" 
                        />
                      </div>


                      {/* Expiry Date */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Expiry Date (if applicable)</Label>
                        <Input 
                          type="date"
                          value={item.expiryDate} 
                          onChange={e => updateItem(idx, 'expiryDate', e.target.value)}
                          className="text-xs" 
                        />
                      </div>

                      {/* Inspection Status */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Inspection Status</Label>
                        <select 
                          className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                          value={item.inspectionStatus}
                          onChange={e => updateItem(idx, 'inspectionStatus', e.target.value)}
                        >
                          <option value="ACCEPTED">✅ Accepted</option>
                          <option value="QUARANTINE">⚠️ Quarantine</option>
                          <option value="REJECTED">❌ Rejected</option>
                        </select>
                      </div>
                    </div>

                    {/* COA and Rejection / Damages tracking */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      {/* COA Checkbox & Number */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={`coa-${idx}`}
                            checked={item.coaRequired}
                            onChange={e => updateItem(idx, 'coaRequired', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <Label htmlFor={`coa-${idx}`} className="text-xs font-medium cursor-pointer">
                            COA (Certificate of Analysis) Required / Attached
                          </Label>
                        </div>
                        {item.coaRequired && (
                          <Input 
                            placeholder="Enter COA Number / Certificate ID" 
                            value={item.coaNumber} 
                            onChange={e => updateItem(idx, 'coaNumber', e.target.value)}
                            className="h-8 text-xs font-mono mt-1"
                          />
                        )}
                      </div>

                      {/* Rejected Qty */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Rejected / Damaged Qty ({item.uomLabel})</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          max={item.actualReceivedQty}
                          placeholder="0"
                          value={item.rejectedQty || ''} 
                          onChange={e => updateItem(idx, 'rejectedQty', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs font-medium"
                        />
                      </div>

                      {/* Rejection Reason */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Rejection Reason</Label>
                        <Input 
                          placeholder="e.g. Broken seal, damaged, leakage" 
                          value={item.rejectionReason} 
                          onChange={e => updateItem(idx, 'rejectionReason', e.target.value)}
                          disabled={!item.rejectedQty || item.rejectedQty <= 0}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Total Summary Footer */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-t border-slate-200 dark:border-slate-800 text-xs sm:text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <span className="text-slate-500 block text-xs">Total Expected</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {totalExpected.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Total Actual Received</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {totalActual.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Total Rejected</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {totalRejected.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Net Accepted Stock</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {netAccepted.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Receipt Information */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              Payment & Receipt Confirmation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date & Time of Delivery *</Label>
                <Input 
                  type="datetime-local" 
                  value={receiptForm.receivedDate} 
                  onChange={e => setReceiptForm(p => ({ ...p, receivedDate: e.target.value }))} 
                  required 
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount Paid (₹) *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={receiptForm.amountPaid} 
                  onChange={e => setReceiptForm(p => ({ ...p, amountPaid: e.target.value }))} 
                  required 
                  placeholder="0.00" 
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Refund / Adjustment Amount (₹)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={receiptForm.refundAmount} 
                  onChange={e => setReceiptForm(p => ({ ...p, refundAmount: e.target.value }))} 
                  placeholder="0.00" 
                  className="font-mono text-xs"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Discrepancy / Bay Notes</Label>
                <textarea
                  className="w-full border rounded-md p-3 h-20 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs resize-none"
                  placeholder="Note any packaging conditions, vehicle seal numbers, temperature readings, or driver remarks..."
                  value={receiptForm.discrepancyNotes}
                  onChange={e => setReceiptForm(p => ({ ...p, discrepancyNotes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Final Delivery / Multi-Shipment Completion Toggle */}
          <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
              <div className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  id="finalDeliveryToggle"
                  checked={isFinalDelivery}
                  onChange={e => setIsFinalDelivery(e.target.checked)}
                  className="mt-0.5 sm:mt-0 w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="finalDeliveryToggle" className="font-bold text-sm text-slate-900 dark:text-white cursor-pointer flex items-center gap-2 flex-wrap">
                    <span>Mark Purchase Order as Fully Delivered</span>
                    {isFinalDelivery ? (
                      <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                        ✓ Complete & Fulfill PO
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                        Partial Shipment (Receive Pending)
                      </span>
                    )}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                    {isFinalDelivery ? (
                      <span>This shipment completes the PO in full. The order will be removed from <strong>Upcoming Deliveries</strong> and archived in <strong>Delivered</strong>.</span>
                    ) : (
                      <span>Only a portion is arriving today. The PO will <strong>remain active in Upcoming Deliveries</strong> with status <strong>"Receive Pending"</strong> so you can receive the remaining quantity tomorrow or in future deliveries.</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsFinalDelivery(prev => !prev)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    isFinalDelivery
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300'
                  }`}
                >
                  {isFinalDelivery ? 'Toggle to Partial' : 'Toggle to Final'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Submission Bar */}
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/grn/upcoming')}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending} 
              className={`gap-2 min-w-44 text-white font-semibold ${
                allItemsExempt 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : allItemsExempt ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {mutation.isPending 
                ? 'Processing...' 
                : isFinalDelivery
                  ? (allItemsExempt ? 'Fulfill & Stock (Exempt)' : 'Fulfill & Queue Lab')
                  : `Receive Partial Delivery (${totalActual.toFixed(2)} ${items[0]?.uomLabel || 'units'})`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

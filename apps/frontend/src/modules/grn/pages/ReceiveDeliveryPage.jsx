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
      invoiceDate: po.supplierInvoiceDate ? format(new Date(po.supplierInvoiceDate), 'yyyy-MM-dd') : '',
    });

    // Prefill financial details
    const poTotal = po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount;
    setReceiptForm(prev => ({
      ...prev,
      amountPaid: String(poTotal || 0)
    }));

    // Setup items list with immediate auto-generated sequential batch format
    const getInitBatch = (name) => {
      const clean = (name || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      return `BATCH-${clean || 'RM'}-001`;
    };

    let rawItems = [];
    if (po.items && Array.isArray(po.items) && po.items.length > 0) {
      rawItems = po.items.map(it => ({
        rmId: it.rmId || it.code || it.id,
        rmName: it.name,
        expectedQty: Number(it.quantity || 0),
        actualReceivedQty: Number(it.quantity || 0),
        returnQty: 0,
        batchNumber: getInitBatch(it.name),
        mfgDate: format(new Date(), 'yyyy-MM-dd'),
        expiryDate: '',
        inspectionStatus: 'ACCEPTED',
        coaRequired: false,
        coaNumber: '',
        rejectedQty: 0,
        rejectionReason: '',
        labTestRequired: it.labTestRequired !== false,
        uomLabel: it.uomLabel || it.uom || po.uom?.abbreviation || 'units',
      }));
    } else {
      rawItems = [{
        rmId: po.rmId,
        rmName: po.name,
        expectedQty: Number(po.quantity || 0),
        actualReceivedQty: Number(po.quantity || 0),
        returnQty: 0,
        batchNumber: getInitBatch(po.name),
        mfgDate: format(new Date(), 'yyyy-MM-dd'),
        expiryDate: '',
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

    // Auto-fetch precise sequential batch number from server per raw material
    rawItems.forEach(async (item, idx) => {
      try {
        const res = await api.get(`/grn/next-batch/${encodeURIComponent(item.rmId)}?rmName=${encodeURIComponent(item.rmName)}`);
        const generated = res.data?.batchNumber || res.data?.nextBatchNumber;
        if (generated) {
          setItems(prev => prev.map((it, i) => i === idx ? { ...it, batchNumber: generated } : it));
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
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const handleGenerateBatch = async (idx) => {
    const item = items[idx];
    if (!item) return;
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

          {/* Items Table & Batch / Quality Inspection Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" /> Material Receipt, Inspection & Batch Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sequential batch numbers are auto-assigned per raw material. Specify expiry, COA, and inspection status.
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
                          <h4 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                            {item.rmName}
                            <span className="font-mono text-xs font-normal text-slate-400">({item.rmId})</span>
                          </h4>
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
                        <span className="text-slate-500 block">Ordered / Expected</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {item.expectedQty} {item.uomLabel}
                        </span>
                      </div>

                      <div>
                        <Label className="text-slate-600 dark:text-slate-300 text-xs block mb-1">
                          Actual Received *
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
                          <span>Batch / Lot Number *</span>
                          <span className="text-[10px] text-indigo-500 font-normal">Auto-sequential per material</span>
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input 
                            placeholder="e.g. BATCH-MILK-001" 
                            value={item.batchNumber} 
                            onChange={e => updateItem(idx, 'batchNumber', e.target.value.toUpperCase())}
                            className="font-mono font-bold text-xs uppercase flex-1" 
                            required 
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateBatch(idx)}
                            className="h-9 px-2.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Auto-generate or refresh batch number"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Auto</span>
                          </button>
                        </div>
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
              {mutation.isPending ? 'Processing...' : allItemsExempt ? 'Receive & Stock (Exempt)' : 'Receive & Queue Lab'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

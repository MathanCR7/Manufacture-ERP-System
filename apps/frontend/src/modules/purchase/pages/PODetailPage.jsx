import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  ArrowLeft, Trash2, User, Calendar, FileText, IndianRupee, Printer, Edit,
  QrCode, Package, FlaskConical, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronRight, Truck, Tag, BarChart3, ShieldCheck, PackageCheck,
  Copy, Check, ExternalLink, Boxes, RefreshCw
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import DashboardBackButton from '@/components/ui/DashboardBackButton';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start space-x-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{value}</p>
      </div>
    </div>
  );
}

function LifecycleStep({ step, active, done, icon: Icon }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
      done ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
      : active ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30 ring-1 ring-indigo-400'
      : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
    }`}>
      <Icon className="w-3.5 h-3.5" />
      {step}
    </div>
  );
}

export default function PODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [highlightActive, setHighlightActive] = useState(!!location.state?.highlight);
  const [copiedBatch, setCopiedBatch] = useState(null);

  useEffect(() => {
    if (highlightActive) {
      const timer = setTimeout(() => {
        setHighlightActive(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightActive]);

  // Fetch PO
  const { data: po, isLoading, error } = useQuery({
    queryKey: ['po', id],
    queryFn: async () => {
      const response = await api.get(`/rm/po/${id}`);
      return response.data;
    }
  });

  // Fetch GRN for this PO fallback
  const { data: grnData } = useQuery({
    queryKey: ['grn-for-po-detail', id],
    queryFn: async () => {
      const res = await api.get(`/grn/receive`);
      const grns = Array.isArray(res.data) ? res.data : [];
      return grns.find(g => g.poId === id) || null;
    },
    enabled: !!id,
  });

  // Fetch direct inventory batches for this PO
  const { data: batchesData } = useQuery({
    queryKey: ['inventory-batches-po', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/inventory?poId=${id}`);
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await api.delete(`/rm/po/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      navigate('/purchase-orders');
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus) => {
      const res = await api.patch(`/grn/po/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po', id] });
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      queryClient.invalidateQueries({ queryKey: ['grn-for-po-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches-po', id] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-deliveries'] });
    }
  });

  const handleCopyBatch = (bNum) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(bNum);
      setCopiedBatch(bNum);
      setTimeout(() => setCopiedBatch(null), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center mt-20">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">PO Not Found</h2>
        <Button onClick={() => navigate('/purchase-orders')} variant="outline" className="mt-4">Back to List</Button>
      </div>
    );
  }

  const isPending = po.status === 'PENDING' || po.status === 'DRAFT';
  const isOrdered = po.status === 'ORDERED';
  const grn = po.grnReceives?.[0] || grnData;

  // Resolve inventory batches from po, direct query, or grn
  const batches = (Array.isArray(po.inventoryBatches) && po.inventoryBatches.length > 0)
    ? po.inventoryBatches
    : ((Array.isArray(batchesData) && batchesData.length > 0)
      ? batchesData
      : (Array.isArray(grn?.inventoryBatches) ? grn.inventoryBatches : []));

  const labTest = grn?.labTest;
  const labCategoryParams = labTest?.categoryParams;

  // Check if Lab Test is Exempt
  const isLabExempt = 
    grn?.isExempt === true ||
    (Array.isArray(po.items) && po.items.length > 0 && po.items.every(i => i.labTestRequired === false)) ||
    (Array.isArray(grn?.items) && grn.items.length > 0 && grn.items.every(i => i.labTestRequired === false));

  const hasBatches = Array.isArray(batches) && batches.length > 0;
  const hasPO = true;
  const hasGRN = !!grn;
  const hasLabTest = !!labTest;
  const labApproved = labTest?.overallDecision === 'APPROVED' || (!isLabExempt && grn?.status === 'LAB_APPROVED');
  const labRejected = labTest?.overallDecision === 'REJECTED' || grn?.status === 'LAB_REJECTED';

  // In inventory condition
  // - If exempt: directly updated into inventory once received / batches created / status uploaded
  // - If lab required: only updated once lab inspection is APPROVED
  const inInventory = isLabExempt
    ? (hasBatches || hasGRN || po.status === 'APPROVED' || po.status === 'RECEIVED' || grn?.inventoryStatus === 'UPLOADED')
    : (labApproved && (hasBatches || grn?.inventoryStatus === 'UPLOADED'));

  // Helper to dynamically resolve the accurate UOM for each batch
  const getBatchUom = (batch) => {
    if (batch?.uom?.abbreviation) return batch.uom.abbreviation;
    if (batch?.uom?.name) return batch.uom.name;
    if (typeof batch?.uom === 'string' && batch.uom.trim()) return batch.uom;
    if (Array.isArray(po.items)) {
      const matched = po.items.find(i => 
        (i.rmId && (i.rmId === batch?.rawMaterialId || i.rmId === batch?.batchNumber)) || 
        (i.code && i.code === batch?.rawMaterialId) || 
        (i.id && (i.id === batch?.rawMaterialId || i.id === batch?.id)) ||
        (i.name && batch?.rawMaterialName && i.name.toLowerCase() === batch.rawMaterialName.toLowerCase())
      );
      if (matched?.uomLabel) return matched.uomLabel;
      if (matched?.unit) return matched.unit;
    }
    return po.uom?.abbreviation || 'KG';
  };

  // Link directly to RM Stock with drawer open for that specific batch and raw material
  const handleViewInStock = (batch = null) => {
    const targetBatch = batch || (batches.length > 0 ? batches[0] : null);
    const matchedItem = Array.isArray(po.items) && targetBatch
      ? po.items.find(i => 
          (i.rmId && (i.rmId === targetBatch.rawMaterialId || i.rmId === targetBatch.batchNumber)) || 
          (i.code && i.code === targetBatch.rawMaterialId) || 
          (i.name && targetBatch.rawMaterialName && i.name.toLowerCase() === targetBatch.rawMaterialName.toLowerCase())
        )
      : null;
    const rawMatCode = matchedItem?.rmId || matchedItem?.code || targetBatch?.rawMaterialId || po.rmId;
    const rawMatName = matchedItem?.name || targetBatch?.rawMaterialName || po.name;
    const rawMatId = targetBatch?.rawMaterialId || matchedItem?.id || po.rmId;
    const batchNum = targetBatch?.batchNumber;

    navigate(
      `/rm/stock?code=${encodeURIComponent(rawMatCode)}&name=${encodeURIComponent(rawMatName)}&materialId=${encodeURIComponent(rawMatId)}&openHistory=true${batchNum ? `&batch=${encodeURIComponent(batchNum)}` : ''}`,
      {
        state: {
          materialId: rawMatId,
          rmCode: rawMatCode,
          rmName: rawMatName,
          batchNumber: batchNum,
          openHistory: true,
          initialTab: 'grn'
        }
      }
    );
  };

  const qrData = JSON.stringify({
    poNumber: po.referenceNo,
    supplierName: po.supplier?.name || '',
    rawMaterial: po.name,
    quantity: po.quantity,
    uom: po.uom?.abbreviation,
    expectedDelivery: po.expectedDelivery,
    poAmount: po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount,
    paymentStatus: po.status,
    labExempt: isLabExempt,
    ...(batches.length > 0 && {
      batchNumbers: batches.map(b => b.batchNumber).join(', '),
      inventoryStatus: 'STORED_IN_STOCK'
    }),
    ...(grn && {
      grnNumber: grn.referenceNo,
      actualReceivedQty: grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0),
      refundAmount: grn.refundAmount,
      amountPaid: grn.amountPaid,
      receivedDate: grn.receivedDate,
      grnStatus: grn.status,
    }),
    ...(labTest && !isLabExempt && {
      labDecision: labTest.overallDecision,
      labNotes: labTest.labNotes,
      labParams: labCategoryParams,
    }),
    generatedAt: new Date().toISOString(),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Isolation Style for Print Dialog */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-rm-label, #printable-rm-label * {
            visibility: visible !important;
          }
          #printable-rm-label {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 100% !important;
            max-width: 360px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            z-index: 999999 !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}</style>

      <DashboardBackButton defaultBack="/purchase-orders" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(location.state?.from || '/purchase-orders')} className="text-slate-500 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">PO: {po.referenceNo || po.rmId}</h1>
              <StatusBadge status={po.status} />

              {/* Exact Badges based on Lab Policy: Exempt vs Required */}
              {isLabExempt ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Lab Exempt
                  </span>
                  {inInventory && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                      <PackageCheck className="w-3.5 h-3.5 text-teal-600" />
                      Inventory Updated
                    </span>
                  )}
                </>
              ) : (
                <>
                  {hasGRN && !labApproved && !labRejected && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
                      Pending Lab
                    </span>
                  )}
                  {labApproved && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Lab Approved
                    </span>
                  )}
                  {labRejected && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-700">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      Lab Rejected
                    </span>
                  )}
                  {inInventory && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                      <PackageCheck className="w-3.5 h-3.5 text-teal-600" />
                      Inventory Updated
                    </span>
                  )}
                </>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Created {format(new Date(po.createdAt), 'PPP')} · RM: {po.rmId}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {isPending && (
            <>
              <Button
                variant="outline"
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                onClick={() => statusMutation.mutate('ORDERED')}
                disabled={statusMutation.isPending}
              >
                🚀 Mark as Ordered
              </Button>
              <AlertDialog>
                <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors">
                  <PackageCheck className="w-4 h-4 mr-1.5" /> Receive & Update Inventory
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Receive Goods & Update Inventory?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark the purchase order as received.
                      {isLabExempt ? ' Because this material is lab exempt, inventory stock will be immediately updated with an assigned batch number.' : ' It will be routed to the lab quality inspection queue.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => statusMutation.mutate('RECEIVED')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {statusMutation.isPending ? 'Processing...' : 'Confirm Receipt'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => navigate(`/purchase-orders/edit/${id}`)}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
            </>
          )}

          {isOrdered && (
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors">
                <PackageCheck className="w-4 h-4 mr-1.5" /> Receive & Update Inventory
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Receive Goods & Update Inventory?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the purchase order as received.
                    {isLabExempt ? ' Because this material is lab exempt, inventory stock will be immediately updated with an assigned batch number.' : ' It will be routed to the lab quality inspection queue.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => statusMutation.mutate('RECEIVED')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {statusMutation.isPending ? 'Processing...' : 'Confirm Receipt'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}



          {!hasBatches && (po.status === 'RECEIVED' || po.status === 'APPROVED') && (
            <Button
              variant="outline"
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1.5"
              onClick={() => statusMutation.mutate('RECEIVED')}
              disabled={statusMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 ${statusMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Inventory
            </Button>
          )}

          <Button variant="outline" onClick={() => window.print()} className="print:hidden gap-2">
            <Printer className="w-4 h-4" /> Print Label
          </Button>

          {isPending && (
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-red-600 hover:bg-red-700 text-white transition-colors">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. PO for {po.name} will be permanently deleted.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Procurement & Inventory Lifecycle Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Procurement & Inventory Lifecycle</p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Step 1: PO Raised */}
          <LifecycleStep step="PO Raised" active={false} done={true} icon={FileText} />
          
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          
          {/* Step 2: GRN Received */}
          <LifecycleStep 
            step="GRN Received" 
            active={isOrdered && !hasGRN} 
            done={hasGRN || inInventory} 
            icon={Truck} 
          />
          
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          
          {/* Step 3: Lab Route (Exempt vs Lab Testing) */}
          {isLabExempt ? (
            <LifecycleStep 
              step="Lab Exempt" 
              active={false} 
              done={hasGRN || inInventory} 
              icon={ShieldCheck} 
            />
          ) : (
            <LifecycleStep 
              step={labRejected ? "Lab Rejected" : (labApproved ? "Lab Approved" : "Lab Testing")} 
              active={hasGRN && !labApproved && !labRejected} 
              done={labApproved} 
              icon={FlaskConical} 
            />
          )}
          
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          
          {/* Step 4: Inventory Updated */}
          <LifecycleStep 
            step="Inventory Updated" 
            active={!isLabExempt && hasGRN && !labApproved && !labRejected} 
            done={inInventory} 
            icon={BarChart3} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="md:col-span-2 space-y-6">

          {/* Section: Inventory Updated & Stock Batches (When Lab Exempt OR Lab Approved) */}
          {inInventory && (
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-400/70 dark:border-emerald-700/60 rounded-xl p-6 shadow-md shadow-emerald-50 dark:shadow-none relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Updated Inventory & Stock Batches
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isLabExempt 
                        ? 'Goods were lab-exempt and directly credited to warehouse stock with sequential batch tracking.' 
                        : 'Goods passed quality lab testing and have been stored into raw material warehouse stock.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isLabExempt && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Lab Exempt
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Inventory Updated
                  </span>
                </div>
              </div>

              {batches.length > 0 ? (
                <div className="space-y-3">
                  {batches.map((batch, idx) => (
                    <div
                      key={batch.id || idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:border-emerald-400 dark:hover:border-emerald-600/70 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              {batch.batchNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyBatch(batch.batchNumber)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              title="Copy Batch Number"
                            >
                              {copiedBatch === batch.batchNumber ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              🟢 {batch.status || 'AVAILABLE'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                            {batch.rawMaterialName || po.name} {batch.rmCategory ? `• ${batch.rmCategory}` : ''}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block font-medium">Net Stock Stored</span>
                          <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                            {Number(batch.netQty || batch.receivedQty || 0).toLocaleString()} {getBatchUom(batch)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Warehouse Location</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{batch.storageLocation || 'Main RM Warehouse'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Mfg Date</span>
                          <span className="font-medium">{batch.mfgDate ? format(new Date(batch.mfgDate), 'dd MMM yyyy') : '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Expiry Date</span>
                          <span className="font-medium">{batch.expiryDate ? format(new Date(batch.expiryDate), 'dd MMM yyyy') : 'No Expiry'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Stock Added Date</span>
                          <span className="font-medium">{batch.createdAt ? format(new Date(batch.createdAt), 'dd MMM yyyy, HH:mm') : '—'}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-dashed border-slate-200 dark:border-slate-700 text-xs flex-wrap gap-2">
                        <span className="text-slate-500">
                          GRN Reference: <strong className="font-mono text-slate-800 dark:text-slate-200">{grn?.referenceNo || 'Direct Inward'}</strong>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1.5 font-medium"
                          onClick={() => handleViewInStock(batch)}
                        >
                          <Boxes className="w-3.5 h-3.5" /> View in RM Stock
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <p className="font-semibold text-slate-900 dark:text-white">Inventory Stock Recorded</p>
                      <p className="text-slate-500">
                        Goods received and inventory stock credited under GRN {grn?.referenceNo || po.referenceNo}.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 gap-1"
                    onClick={() => handleViewInStock()}
                  >
                    <Boxes className="w-3.5 h-3.5" /> View RM Stock
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Section: Lab Testing Queue Pending (When Lab Test Required and not yet approved) */}
          {!isLabExempt && hasGRN && !labApproved && !labRejected && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/60 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                      Quality Lab Testing in Progress
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Material must be tested and approved by QA/QC before inventory stock is updated.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  Pending Lab Test
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800/50 text-xs flex-wrap gap-2">
                <span className="text-amber-800 dark:text-amber-300">
                  GRN Reference: <strong className="font-mono">{grn.referenceNo}</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950"
                  onClick={() => navigate('/grn/lab-tests')}
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1" /> View in Lab Test Queue
                </Button>
              </div>
            </div>
          )}

          {/* Material & Item Details */}
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-all duration-1000 ${highlightActive ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-50/10 dark:bg-indigo-950/15 animate-pulse' : ''}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500" /> Material & Ordered Items
              </h3>
              <div className="text-xs text-slate-500">
                Supplier: <span className="font-semibold text-slate-700 dark:text-slate-300">{po.supplier?.name || '—'}</span>
              </div>
            </div>

            {Array.isArray(po.items) && po.items.length > 0 ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Item & Code</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Quality / Lab Route</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {po.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{item.rmId || item.code || '—'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.itemType === 'NON_INVENTORY'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {item.itemType === 'NON_INVENTORY' ? '🚫 Non-Inv' : '🌾 Raw Mat'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {item.quantity} {item.uomLabel || item.uom || ''}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                            ₹{Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white font-mono">
                            ₹{Number(item.total || ((item.quantity || 0) * (item.unitPrice || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.labTestRequired !== false ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                <FlaskConical className="w-3 h-3 text-violet-500" /> Lab Required
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Lab Exempt (Direct)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <InfoRow icon={FileText} label="Raw Material Name" value={po.name} />
                <InfoRow icon={Tag} label="RM Code / ID" value={po.rmId} />
                <InfoRow icon={Package} label="Quantity" value={`${po.quantity} ${po.uom?.abbreviation || ''}`} />
                <InfoRow icon={User} label="Supplier" value={po.supplier?.name || '—'} />
                <div className="flex items-center justify-between pt-3 text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5 text-slate-400" /> Quality / Lab Inspection Policy:
                  </span>
                  {isLabExempt ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Lab Exempt (Direct to Inventory)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      <FlaskConical className="w-3.5 h-3.5 text-violet-500" /> Lab Test Required
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Supplier Invoice & Logistics / E-Way Bill Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-500" /> Logistics, Invoice & E-Way Bill
              </span>
              {po.ewayBillNo && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                  E-Way Active
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <InfoRow 
                icon={FileText} 
                label="Supplier Invoice No" 
                value={po.supplierInvoiceNo || '—'} 
              />
              <InfoRow 
                icon={Calendar} 
                label="Supplier Invoice Date" 
                value={po.supplierInvoiceDate ? format(new Date(po.supplierInvoiceDate), 'dd MMM yyyy') : '—'} 
              />
              <InfoRow 
                icon={Truck} 
                label="Transport Mode" 
                value={
                  po.transportMode === 'ROAD' ? '🚛 Road Transport' :
                  po.transportMode === 'RAIL' ? '🚆 Rail Express' :
                  po.transportMode === 'AIR' ? '✈️ Air Freight' :
                  po.transportMode === 'SHIP' ? '🚢 Ship / Maritime' :
                  (po.transportMode || '🚛 Road Transport')
                } 
              />
              <InfoRow 
                icon={Truck} 
                label="Vehicle Number" 
                value={po.vehicleNumber || '—'} 
              />
              <InfoRow 
                icon={User} 
                label="Transporter / Carrier" 
                value={po.transporterName || '—'} 
              />
              <InfoRow 
                icon={FileText} 
                label="E-Way Bill Number" 
                value={po.ewayBillNo ? (
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {po.ewayBillNo}
                  </span>
                ) : '—'} 
              />
              <InfoRow 
                icon={Calendar} 
                label="E-Way Bill Date" 
                value={po.ewayBillDate ? format(new Date(po.ewayBillDate), 'dd MMM yyyy') : '—'} 
              />
              <InfoRow 
                icon={Clock} 
                label="Valid Till Date" 
                value={po.tillDate ? (
                  <span className="flex items-center gap-1.5">
                    <span>{format(new Date(po.tillDate), 'dd MMM yyyy')}</span>
                    {new Date(po.tillDate) < new Date() ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold">Expired</span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">Valid</span>
                    )}
                  </span>
                ) : '—'} 
              />
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-500" /> Financial & Tax Details
            </h3>
            <div className="space-y-2 mb-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Subtotal:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  ₹{parseFloat(po.subtotal || po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {Number(po.cgst || 0) > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">CGST:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    ₹{parseFloat(po.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Number(po.sgst || 0) > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">SGST:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    ₹{parseFloat(po.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Number(po.discount || 0) > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Discount:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    -₹{parseFloat(po.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Number(po.shipping || 0) > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Shipping:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    +₹{parseFloat(po.shipping).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {Number(po.otherCharges || 0) > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Other Charges:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    +₹{parseFloat(po.otherCharges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-2.5 font-bold text-base text-indigo-600 dark:text-indigo-400">
                <span>Grand Total:</span>
                <span>
                  ₹{parseFloat(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Payment Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-lg border ${
                  (po.paymentStatus || 'UNPAID') === 'PAID'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : po.paymentStatus === 'PARTIALLY_PAID'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                }`}>
                  {po.paymentStatus === 'PAID' ? '🟢 PAID' : po.paymentStatus === 'PARTIALLY_PAID' ? '🔵 PARTIALLY PAID' : '🔴 UNPAID'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Amount Paid:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{parseFloat(po.paidAmount || (po.paymentStatus === 'PAID' ? (po.grandTotal || po.amount) : 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Balance Due:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                  ₹{Math.max(0, (po.grandTotal && Number(po.grandTotal) > 0 ? Number(po.grandTotal) : Number(po.amount)) - Number(po.paidAmount || (po.paymentStatus === 'PAID' ? (po.grandTotal || po.amount) : 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <InfoRow icon={Calendar} label="Expected Delivery" value={format(new Date(po.expectedDelivery), 'PPPP')} />
            <InfoRow icon={User} label="Created By" value={po.user?.name || '—'} />
          </div>

          {/* GRN Details */}
          {grn && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-500" /> GRN Receipt Details
              </h3>
              <InfoRow icon={FileText} label="GRN Reference" value={grn.referenceNo} />
              <InfoRow icon={Calendar} label="Received Date" value={grn.receivedDate ? format(new Date(grn.receivedDate), 'PPP') : '—'} />
              <InfoRow icon={Package} label="Items" value={`${grn.items?.length || 0} item(s)`} />
              <InfoRow icon={IndianRupee} label="Amount Paid" value={`₹${Number(grn.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              <InfoRow icon={IndianRupee} label="Refund Amount" value={`₹${Number(grn.refundAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
              {grn.items?.map(item => (
                <div key={item.id} className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{item.rmName}</p>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>Expected: {Number(item.expectedQty).toLocaleString()}</span>
                    <span>Received: <strong>{Number(item.actualReceivedQty).toLocaleString()}</strong></span>
                    {Number(item.returnQty) > 0 && <span className="text-red-500">Return: {Number(item.returnQty).toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lab Test Results (Only if NOT exempt and lab test performed) */}
          {!isLabExempt && labTest && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-violet-500" /> Lab Test Results
              </h3>
              <div className="flex items-center gap-3 mb-4">
                {labTest.overallDecision === 'APPROVED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Approved
                  </span>
                )}
                {labTest.overallDecision === 'REJECTED' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                    <XCircle className="w-4 h-4" /> Rejected
                  </span>
                )}
                {labTest.overallDecision === 'NEED_SAMPLE' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" /> Re-sample Required
                  </span>
                )}
              </div>

              {labTest.labNotes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400 mb-3">
                  <strong>Lab Notes:</strong> {labTest.labNotes}
                </div>
              )}

              {labCategoryParams && typeof labCategoryParams === 'object' && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Test Parameters</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(labCategoryParams).map(([param, val]) => (
                      <div key={param} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                        <span className="text-slate-500">{param}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {labTest.testResults?.map(tr => (
                <div key={tr.id} className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">{tr.rmName}</p>
                    <p className="text-xs text-slate-400">Expiry: {tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '—'}</p>
                    {tr.testNotes && <p className="text-xs text-slate-500 mt-0.5">{tr.testNotes}</p>}
                  </div>
                  {tr.passed
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <XCircle className="w-5 h-5 text-red-500" />
                  }
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: On-screen QR Card */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center space-y-4 sticky top-6">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 w-full text-center">
              <span className="flex items-center justify-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-500" /> RM QR Code
              </span>
            </h3>

            <div 
              draggable="true"
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', qrData);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-md transition-all duration-200"
              title="Drag and drop this QR code onto the header Scan icon to track its lifecycle!"
            >
              <QRCode value={qrData} size={168} level="M" fgColor="#0f172a" />
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 w-full text-center">
              <span className="font-mono text-base font-bold tracking-wider text-slate-800 dark:text-slate-200">{po.referenceNo || po.rmId}</span>
            </div>

            {batches.length > 0 && (
              <div className="w-full p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                <span className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-bold block">
                  Active Stock Batch
                </span>
                <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  {batches[0].batchNumber}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                  {Number(batches[0].netQty || batches[0].receivedQty || 0)} {getBatchUom(batches[0])} AVAILABLE
                </span>
              </div>
            )}

            <div className="w-full space-y-1.5 text-xs">
              {[
                { label: 'PO Details', done: true },
                { label: 'GRN Receipt', done: hasGRN || inInventory },
                { label: isLabExempt ? 'Lab Exempt' : 'Lab Quality Test', done: isLabExempt ? (hasGRN || inInventory) : labApproved },
                { label: 'Inventory Updated', done: inInventory },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-2 px-2 py-1 rounded ${s.done ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}`}>
                  {s.done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    : <Clock className="w-3.5 h-3.5" />
                  }
                  {s.label}
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-slate-400">Scan to view all accumulated procurement & stock details</p>
          </div>
        </div>
      </div>

      {/* Strict Printable RM Label Card (Only visible during print dialog) */}
      <div id="printable-rm-label" className="hidden">
        <div className="border-3 border-black p-5 rounded-2xl flex flex-col items-center max-w-[340px] w-full space-y-4 bg-white text-black">
          <h1 className="text-2xl font-black uppercase tracking-widest border-b-2 border-black pb-1.5 w-full text-center text-black">
            RM LABEL
          </h1>
          <div className="bg-white p-2 border-2 border-black rounded-xl">
            <QRCode value={qrData} size={175} level="M" fgColor="#000000" bgColor="#ffffff" />
          </div>
          <div className="w-full space-y-1.5 text-xs font-bold text-black">
            {[
              { label: 'REF NO', value: po.referenceNo || po.rmId },
              { label: 'ITEM', value: po.name },
              { label: 'QUANTITY', value: `${po.quantity} ${po.uom?.abbreviation || ''}` },
              ...(batches.length > 0 ? [{ label: 'BATCH NO', value: batches.map(b => b.batchNumber).join(', ') }] : []),
              { label: 'SUPPLIER', value: po.supplier?.name || '—' },
              ...(po.supplierInvoiceNo ? [{ label: 'SUPP INV', value: po.supplierInvoiceNo }] : []),
              ...(po.transportMode ? [{ label: 'TRANS MODE', value: po.transportMode }] : []),
              ...(po.vehicleNumber ? [{ label: 'VEHICLE NO', value: po.vehicleNumber }] : []),
              ...(po.ewayBillNo ? [{ label: 'E-WAY BILL', value: po.ewayBillNo }] : []),
              ...(po.tillDate ? [{ label: 'VALID TILL', value: format(new Date(po.tillDate), 'dd-MM-yyyy') }] : []),
              { label: 'EXP. DELIVERY', value: format(new Date(po.expectedDelivery), 'dd-MM-yyyy') },
              { label: 'STATUS', value: po.status },
              ...(grn ? [
                { label: 'GRN NO', value: grn.referenceNo },
                { label: 'RCVD DATE', value: grn.receivedDate ? format(new Date(grn.receivedDate), 'dd-MM-yyyy') : '—' },
              ] : []),
              { label: 'QUALITY', value: isLabExempt ? 'LAB EXEMPT' : (labApproved ? 'LAB APPROVED' : (labRejected ? 'LAB REJECTED' : 'PENDING LAB')) },
              { label: 'PRINTED', value: format(new Date(), 'dd-MM-yyyy HH:mm') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between border-b border-gray-300 pb-0.5 items-center">
                <span className="text-gray-700 font-extrabold uppercase text-[10px] tracking-wider">{label}:</span>
                <span className="text-right font-black text-xs text-black font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

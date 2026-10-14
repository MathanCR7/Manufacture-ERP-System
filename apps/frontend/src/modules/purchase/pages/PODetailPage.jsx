import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  ArrowLeft, Trash2, User, Calendar, FileText, IndianRupee, Edit,
  QrCode, Package, FlaskConical, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronRight, Truck, Tag, BarChart3, ShieldCheck, PackageCheck,
  Copy, Check, Boxes, RefreshCw, Scale,
  Image as ImageIcon, UploadCloud, Eye,
  RotateCcw, Undo2, Download, Phone, Mail, MapPin, Building, Building2,
  Paperclip, ExternalLink, Layers, ArrowUpRight, AlertCircle, CheckCircle,
  FileCheck, History, Info, Plus
} from 'lucide-react';
import { 
  UpdatePaymentSettlementModal, 
  PaymentSettlementCardView 
} from '../components/PaymentSettlementManager';
import { 
  SupplierInvoiceModal, 
  InvoiceViewerToolModal 
} from '../components/SupplierInvoiceManager';
import {
  parseInvoiceFiles,
  downloadInvoiceFile,
  isPdfDocument
} from '../utils/supplierInvoiceUtils';
import { ImagePreviewModal } from '../components/PaymentFieldsSection';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import DashboardBackButton from '@/components/ui/DashboardBackButton';
import POExportModal from '../components/POExportModal';
import GstCalculationModal, { calculateGstBreakdown } from '../components/GstCalculationModal';
import useCompanyStore from '@/app/store/companyStore';

// Safely import QRCode
import _QRCode from 'react-qr-code';
const QRCode = typeof _QRCode === 'function' ? _QRCode : (_QRCode?.default || _QRCode?.QRCode || 'div');

function SapFieldItem({ label, value, icon: Icon, isMono = false, highlight = false, className = '' }) {
  return (
    <div className={`p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 ${className}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
        {Icon && <Icon className="w-3 h-3 text-slate-400 shrink-0" />}
        <span>{label}</span>
      </div>
      <div className={`mt-0.5 text-xs font-semibold ${isMono ? 'font-mono' : ''} ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'} truncate`}>
        {value || '—'}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start space-x-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-xs">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function LifecycleStep({ step, active, done, icon: Icon }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
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
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInstallmentIndex, setSelectedInstallmentIndex] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [previewInvoiceModal, setPreviewInvoiceModal] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalFormat, setExportModalFormat] = useState('PDF');
  const fetchCompany = useCompanyStore((s) => s.fetchCompany);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    if (highlightActive) {
      const timer = setTimeout(() => {
        setHighlightActive(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightActive]);

  // Fetch PO Details
  const { data: po, isLoading, error } = useQuery({
    queryKey: ['po', id],
    queryFn: async () => {
      const response = await api.get(`/rm/po/${id}`);
      return response.data;
    }
  });

  // Fetch ALL GRNs from /grn/receive to support multiple partial deliveries
  const { data: allPoGrns = [] } = useQuery({
    queryKey: ['grns-for-po-detail', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/grn/receive`);
        const list = Array.isArray(res.data) ? res.data : [];
        return list.filter(g => g.poId === id || g.po?.id === id || g.poReferenceNo === po?.referenceNo);
      } catch {
        return [];
      }
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
      queryClient.invalidateQueries({ queryKey: ['grns-for-po-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches-po', id] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-lab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['rm-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['po-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['po-edit', id] });
    }
  });

  const handleCopyBatch = (bNum) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(bNum);
      setCopiedBatch(bNum);
      setTimeout(() => setCopiedBatch(null), 2000);
    }
  };

  // Merge and sort all GRNs associated with this PO (handles multiple partial deliveries)
  const grnList = useMemo(() => {
    const map = new Map();
    if (Array.isArray(po?.grnReceives)) {
      po.grnReceives.forEach(g => {
        if (g && (g.id || g.referenceNo)) map.set(g.id || g.referenceNo, g);
      });
    }
    if (Array.isArray(allPoGrns)) {
      allPoGrns.forEach(g => {
        if (g && (g.id || g.referenceNo)) {
          const key = g.id || g.referenceNo;
          const existing = map.get(key) || {};
          map.set(key, { ...existing, ...g });
        }
      });
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.receivedDate || a.createdAt || 0) - new Date(b.receivedDate || b.createdAt || 0)
    );
  }, [po?.grnReceives, allPoGrns]);

  // Primary GRN (fallback/most recent for singular properties)
  const grn = grnList[0] || null;

  // Resolve inventory batches from po, direct query, or all linked GRNs
  const batches = useMemo(() => {
    const map = new Map();
    const add = (b) => {
      if (!b) return;
      const key = b.id || b.batchNumber;
      if (key) {
        if (!map.has(key)) map.set(key, b);
        else map.set(key, { ...map.get(key), ...b });
      }
    };
    if (Array.isArray(po?.inventoryBatches)) po.inventoryBatches.forEach(add);
    if (Array.isArray(batchesData)) batchesData.forEach(add);
    grnList.forEach(g => {
      if (Array.isArray(g.inventoryBatches)) g.inventoryBatches.forEach(add);
    });
    return Array.from(map.values());
  }, [po?.inventoryBatches, batchesData, grnList]);

  // Lab test resolved across GRNs
  const labTest = grnList.find(g => g.labTest)?.labTest || grn?.labTest || null;
  const labCategoryParams = labTest?.categoryParams;

  // Check if Lab Test is Exempt
  const isLabExempt = 
    grnList.some(g => g.isExempt === true) ||
    grn?.isExempt === true ||
    (Array.isArray(po?.items) && po.items.length > 0 && po.items.every(i => i.labTestRequired === false)) ||
    (grnList.length > 0 && grnList.every(g => Array.isArray(g.items) && g.items.length > 0 && g.items.every(i => i.labTestRequired === false)));

  const hasBatches = batches.length > 0;
  const hasGRN = grnList.length > 0;
  const labApproved = labTest?.overallDecision === 'APPROVED' || (!isLabExempt && grnList.some(g => g.status === 'LAB_APPROVED'));
  const labRejected = labTest?.overallDecision === 'REJECTED' || grnList.some(g => g.status === 'LAB_REJECTED');

  // In inventory condition
  const inInventory = isLabExempt
    ? (hasBatches || hasGRN || po?.status === 'APPROVED' || po?.status === 'RECEIVED' || grnList.some(g => g.inventoryStatus === 'UPLOADED'))
    : (labApproved && (hasBatches || grnList.some(g => g.inventoryStatus === 'UPLOADED')));

  // Partial Delivery Calculations
  const totalOrderedQty = useMemo(() => {
    if (Array.isArray(po?.items) && po.items.length > 0) {
      return po.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    }
    return Number(po?.quantity || 0);
  }, [po]);

  const totalReceivedQty = useMemo(() => {
    return grnList.reduce((sum, g) => {
      if (g.totalReceivedQty != null) return sum + Number(g.totalReceivedQty);
      if (Array.isArray(g.items)) return sum + g.items.reduce((s, it) => s + (Number(it.actualReceivedQty) || 0), 0);
      return sum;
    }, 0);
  }, [grnList]);

  const deliveryProgressPct = totalOrderedQty > 0
    ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100))
    : (hasGRN ? 100 : 0);

  const totalPendingQty = Math.max(0, totalOrderedQty - totalReceivedQty);
  const isPartiallyDelivered = totalReceivedQty > 0 && totalReceivedQty < totalOrderedQty;
  const isFullyDelivered = totalOrderedQty > 0 && totalReceivedQty >= totalOrderedQty;

  // Helper to dynamically resolve the accurate respective UOM for each batch
  const getBatchUom = (batch) => {
    if (!batch) return po?.uom?.abbreviation || '';

    // 1. Prioritize matching the respective line item in po.items
    if (Array.isArray(po?.items)) {
      const matched = po.items.find(i => 
        (i.rmId && (i.rmId === batch?.rawMaterialId || i.rmId === batch?.batchNumber)) || 
        (i.code && (i.code === batch?.rawMaterialId || i.code === batch?.batchNumber)) || 
        (i.id && (i.id === batch?.rawMaterialId || i.id === batch?.id)) ||
        (i.name && batch?.rawMaterialName && i.name.trim().toLowerCase() === batch.rawMaterialName.trim().toLowerCase())
      );
      if (matched?.uomLabel) return matched.uomLabel;
      if (matched?.uom) return typeof matched.uom === 'object' ? (matched.uom.abbreviation || matched.uom.name) : matched.uom;
      if (matched?.unit) return matched.unit;
    }

    // 2. Next, check if batch itself has its own accurate UOM populated
    if (batch?.uom?.abbreviation) return batch.uom.abbreviation;
    if (batch?.uom?.name) return batch.uom.name;
    if (typeof batch?.uom === 'string' && batch.uom.trim()) return batch.uom;

    // 3. Fallback to po's overall UOM
    return po?.uom?.abbreviation || '';
  };

  // Link directly to RM Stock with drawer open for that specific batch and raw material
  const handleViewInStock = (batch = null) => {
    const targetBatch = batch || (batches.length > 0 ? batches[0] : null);
    const matchedItem = Array.isArray(po?.items) && targetBatch
      ? po.items.find(i => 
          (i.rmId && (i.rmId === targetBatch.rawMaterialId || i.rmId === targetBatch.batchNumber)) || 
          (i.code && i.code === targetBatch.rawMaterialId) || 
          (i.name && targetBatch.rawMaterialName && i.name.toLowerCase() === targetBatch.rawMaterialName.toLowerCase())
        )
      : null;
    const rawMatCode = matchedItem?.rmId || matchedItem?.code || targetBatch?.rawMaterialId || po?.rmId;
    const rawMatName = matchedItem?.name || targetBatch?.rawMaterialName || po?.name;
    const rawMatId = targetBatch?.rawMaterialId || matchedItem?.id || po?.rmId;
    const batchNum = targetBatch?.batchNumber;

    navigate(
      `/rm/stock?code=${encodeURIComponent(rawMatCode || '')}&name=${encodeURIComponent(rawMatName || '')}&materialId=${encodeURIComponent(rawMatId || '')}&openHistory=true${batchNum ? `&batch=${encodeURIComponent(batchNum)}` : ''}`,
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

  if (isLoading) {
    return (
      <div className="w-full max-w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4 mx-auto">
        <Skeleton className="h-9 w-64 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-56 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <Skeleton className="h-96 w-full rounded-lg lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center mt-16 p-8 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Purchase Order Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested PO could not be located or has been deleted.</p>
        <Button onClick={() => navigate('/purchase-orders')} variant="outline" className="mt-4 text-xs font-semibold">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Purchase Orders
        </Button>
      </div>
    );
  }

  const isPending = po.status?.toUpperCase() === 'PENDING' || po.status?.toUpperCase() === 'DRAFT';
  const isOrdered = po.status === 'ORDERED';

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
    grnCount: grnList.length,
    ...(batches.length > 0 && {
      batchNumbers: batches.map(b => b.batchNumber).join(', '),
      inventoryStatus: 'STORED_IN_STOCK'
    }),
    ...(grnList.length > 0 && {
      grnNumbers: grnList.map(g => g.referenceNo).join(', '),
      totalReceivedQty: totalReceivedQty,
    }),
    generatedAt: new Date().toISOString(),
  });

  return (
    <div className="w-full max-w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4 mx-auto text-slate-900 dark:text-slate-100 transition-all duration-200">
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

      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DashboardBackButton defaultBack="/purchase-orders" />
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <Link to="/purchase-orders" className="hover:text-indigo-600 transition-colors">Purchase Orders</Link>
          <span>/</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{po.referenceNo || po.id}</span>
        </div>
      </div>

      {/* SAP Style Executive Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Left: Document Key Info */}
          <div className="flex items-start sm:items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(location.state?.from || '/purchase-orders')} 
              className="h-8 w-8 rounded-md text-slate-500 shrink-0 border-slate-200 dark:border-slate-700"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  SAP Purchase Order
                </span>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                  {po.referenceNo || po.rmId}
                </h1>
                <StatusBadge status={po.status} />

                {/* Lab Status Badges */}
                {isLabExempt ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Lab Exempt
                  </span>
                ) : (
                  <>
                    {hasGRN && !labApproved && !labRejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        <FlaskConical className="w-3 h-3 text-amber-600" />
                        Pending Lab QC
                      </span>
                    )}
                    {labApproved && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Lab Approved
                      </span>
                    )}
                    {labRejected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        Lab Rejected
                      </span>
                    )}
                  </>
                )}

                {/* Inventory Badge */}
                {inInventory && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                    <PackageCheck className="w-3 h-3 text-teal-600" />
                    Stock Credited ({batches.length} Batch{batches.length > 1 ? 'es' : ''})
                  </span>
                )}

                {/* Partial Delivery / Multi-GRN Badge */}
                {isPartiallyDelivered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                    <Truck className="w-3 h-3 text-indigo-600" />
                    Partial Delivery: {deliveryProgressPct}% ({grnList.length} Shipment{grnList.length > 1 ? 's' : ''})
                  </span>
                )}

                {isFullyDelivered && grnList.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Complete Delivery ({grnList.length} Shipments)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span>Created: <strong>{format(new Date(po.createdAt), 'dd MMM yyyy')}</strong></span>
                <span>•</span>
                <span>Supplier: <strong className="text-slate-800 dark:text-slate-200">{po.supplier?.name || po.supplierName || '—'}</strong></span>
                <span>•</span>
                <span>Expected: <strong>{po.expectedDelivery ? format(new Date(po.expectedDelivery), 'dd MMM yyyy') : '—'}</strong></span>
                <span>•</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Total: ₹{parseFloat(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Right: SAP Actions Toolbar */}
          <div className="flex items-center flex-wrap gap-1.5 shrink-0">
            {isPending && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 gap-1"
                  onClick={() => statusMutation.mutate('ORDERED')}
                  disabled={statusMutation.isPending}
                >
                  🚀 Mark Ordered
                </Button>

                <Button 
                  size="sm"
                  variant="outline" 
                  className="h-8 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 gap-1" 
                  onClick={() => navigate(`/purchase-orders/edit/${id}`)}
                >
                  <Edit className="w-3.5 h-3.5" /> Edit PO
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors gap-1 cursor-pointer">
                    <PackageCheck className="w-3.5 h-3.5" /> Receive & Stock
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
              </>
            )}

            {isOrdered && (
              <>
                <Button
                  size="sm"
                  className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
                  onClick={() => navigate(`/grn/receive/${po.id}`)}
                  title="Receive goods inward via dedicated GRN form"
                >
                  <Truck className="w-3.5 h-3.5" /> Receive Goods (GRN)
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger
                    className="inline-flex items-center justify-center rounded-md border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 px-2.5 h-8 text-xs font-semibold gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    disabled={statusMutation.isPending}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Revert Draft
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revert Order to Draft?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will move the purchase order back to Draft (Pending) status so you can edit order details, items, or quantities.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => statusMutation.mutate('PENDING')}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {statusMutation.isPending ? 'Reverting...' : 'Confirm Revert'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* Quick action for partial delivery receiving */}
            {isPartiallyDelivered && (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shadow-xs"
                onClick={() => navigate(`/grn/receive/${po.id}`)}
                title={`Receive remaining ${totalPendingQty} ${po.uom?.abbreviation || ''}`}
              >
                <Plus className="w-3.5 h-3.5" /> Receive Next Shipment
              </Button>
            )}

            {(po.status === 'RECEIVED' || po.status === 'APPROVED') && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger
                    className="inline-flex items-center justify-center rounded-md border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 px-2.5 h-8 text-xs font-semibold gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    disabled={statusMutation.isPending}
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Undo Receive
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Undo Receipt & Revert to Ordered?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all GRNs and generated batches for this PO, reverse any stock added to inventory, and reset the PO status to ORDERED.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => statusMutation.mutate('ORDERED')}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {statusMutation.isPending ? 'Reverting...' : 'Confirm Undo'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger
                    className="inline-flex items-center justify-center rounded-md border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2.5 h-8 text-xs font-semibold gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    disabled={statusMutation.isPending}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Revert Draft
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revert Purchase Order to Draft?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all GRNs, revert any stock added to inventory, remove all batches, and place the PO back in DRAFT status.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => statusMutation.mutate('PENDING')}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        {statusMutation.isPending ? 'Reverting...' : 'Confirm Revert'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {!hasBatches && (po.status === 'RECEIVED' || po.status === 'APPROVED') && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1"
                onClick={() => statusMutation.mutate('RECEIVED')}
                disabled={statusMutation.isPending}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statusMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Stock
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setExportModalFormat('EXCEL');
                setIsExportModalOpen(true);
              }} 
              className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 gap-1.5"
              title="Export Purchase Order to Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Excel
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setExportModalFormat('PDF');
                setIsExportModalOpen(true);
              }} 
              className="h-8 text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 gap-1.5"
              title="Download complete Purchase Order PDF"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> PDF
            </Button>

            {isPending && (
              <AlertDialog>
                <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 px-2.5 bg-rose-600 hover:bg-rose-700 text-white transition-colors gap-1 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. PO for {po.name} will be permanently deleted.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-rose-600 hover:bg-rose-700 text-white">
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Procurement & Inventory Lifecycle Bar (Compact SAP Ribbon) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            <Layers className="w-3 h-3 text-slate-400" /> Lifecycle Status:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <LifecycleStep step="PO Raised" active={false} done={true} icon={FileText} />
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
            
            <LifecycleStep 
              step={grnList.length > 1 ? `GRN Received (${grnList.length} Shipments)` : 'GRN Received'} 
              active={isOrdered && !hasGRN} 
              done={hasGRN || inInventory} 
              icon={Truck} 
            />
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
            
            {isLabExempt ? (
              <LifecycleStep 
                step="Lab Exempt (Direct)" 
                active={false} 
                done={hasGRN || inInventory} 
                icon={ShieldCheck} 
              />
            ) : (
              <LifecycleStep 
                step={labRejected ? "Lab Rejected" : (labApproved ? "Lab Approved" : "Lab Quality Inspection")} 
                active={hasGRN && !labApproved && !labRejected} 
                done={labApproved} 
                icon={FlaskConical} 
              />
            )}
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
            
            <LifecycleStep 
              step="Stock Batches Stored" 
              active={!isLabExempt && hasGRN && !labApproved && !labRejected} 
              done={inInventory} 
              icon={BarChart3} 
            />
          </div>
        </div>
      </div>

      {/* Main Grid: 3-Columns Left / 1-Column Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column (Primary Content) */}
        <div className="lg:col-span-3 space-y-4">

          {/* ───────────────────────────────────────────────────────────────────
              TOP SECTION (ABOVE ALL): SUPPLIER & VENDOR DETAILS + LOGISTICS & INVOICE
              ─────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Supplier & Vendor Master Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Supplier & Vendor Details
                      </h3>
                      <p className="text-[10px] text-slate-400">Master Data & Tax Profile</p>
                    </div>
                  </div>

                  {/* Supplier Redirection Link */}
                  <button
                    type="button"
                    onClick={() => {
                      if (po.supplier?.id) {
                        navigate(`/parties/suppliers/edit/${po.supplier.id}`, { state: po.supplier });
                      } else {
                        navigate(`/parties/suppliers?search=${encodeURIComponent(po.supplier?.name || po.supplierName || '')}`);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    title="View Supplier Profile in Master Directory"
                  >
                    <span>Supplier Master</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2">
                    <SapFieldItem
                      label="Company / Vendor Name"
                      value={po.supplier?.name || po.supplierName || '—'}
                      icon={Building}
                      highlight={true}
                    />
                  </div>

                  <SapFieldItem
                    label="Contact Person"
                    value={po.supplier?.contactPerson || po.supplier?.contact_person || '—'}
                    icon={User}
                  />

                  <SapFieldItem
                    label="Phone / Mobile"
                    value={po.supplier?.phone || po.supplier?.mobile || '—'}
                    icon={Phone}
                    isMono={true}
                  />

                  <SapFieldItem
                    label="Email Address"
                    value={po.supplier?.email || '—'}
                    icon={Mail}
                  />

                  <SapFieldItem
                    label="PAN Number"
                    value={po.supplier?.pan || '—'}
                    icon={Tag}
                    isMono={true}
                  />

                  <div className="col-span-2">
                    <SapFieldItem
                      label="GSTIN & Tax Category"
                      value={
                        po.supplier?.gstin ? (
                          <span className="flex items-center justify-between gap-1">
                            <span className="font-mono font-bold">{po.supplier.gstin}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                              {po.supplier.gstin.trim().startsWith('33') ? 'Intrastate (Tamil Nadu)' : 'Interstate (IGST)'}
                            </span>
                          </span>
                        ) : 'Not Registered'
                      }
                      icon={Tag}
                    />
                  </div>

                  <div className="col-span-2">
                    <SapFieldItem
                      label="Registered Warehouse / Office Address"
                      value={[
                        po.supplier?.address,
                        po.supplier?.city,
                        po.supplier?.state,
                        po.supplier?.pincode ? `PIN: ${po.supplier.pincode}` : ''
                      ].filter(Boolean).join(', ') || po.supplier?.address || '—'}
                      icon={MapPin}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Logistics, Invoice & E-Way Bill Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Logistics, Invoice & E-Way Bill
                      </h3>
                      <p className="text-[10px] text-slate-400">Inward Transport & Tax Compliance</p>
                    </div>
                  </div>

                  {po.ewayBillNo && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                      E-Way Bill Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <SapFieldItem
                    label="Supplier Invoice No"
                    value={po.supplierInvoiceNo || '—'}
                    icon={FileText}
                    isMono={true}
                    highlight={!!po.supplierInvoiceNo}
                  />

                  <SapFieldItem
                    label="Supplier Invoice Date"
                    value={po.supplierInvoiceDate ? format(new Date(po.supplierInvoiceDate), 'dd MMM yyyy') : '—'}
                    icon={Calendar}
                  />

                  <SapFieldItem
                    label="Transport Mode"
                    value={
                      po.transportMode === 'ROAD' ? '🚛 Road Transport' :
                      po.transportMode === 'RAIL' ? '🚆 Rail Freight' :
                      po.transportMode === 'AIR' ? '✈️ Air Cargo' :
                      po.transportMode === 'SHIP' ? '🚢 Ship / Maritime' :
                      (po.transportMode || '🚛 Road Transport')
                    }
                    icon={Truck}
                  />

                  <SapFieldItem
                    label="Vehicle Number"
                    value={po.vehicleNumber || '—'}
                    icon={Truck}
                    isMono={true}
                  />

                  <SapFieldItem
                    label="Transporter / Carrier"
                    value={po.transporterName || '—'}
                    icon={User}
                  />

                  <SapFieldItem
                    label="E-Way Bill Number"
                    value={po.ewayBillNo || '—'}
                    icon={FileText}
                    isMono={true}
                    highlight={!!po.ewayBillNo}
                  />

                  <SapFieldItem
                    label="E-Way Bill Date"
                    value={po.ewayBillDate ? format(new Date(po.ewayBillDate), 'dd MMM yyyy') : '—'}
                    icon={Calendar}
                  />

                  <SapFieldItem
                    label="Validity / Till Date"
                    value={po.tillDate ? (
                      <span className="flex items-center justify-between gap-1">
                        <span>{format(new Date(po.tillDate), 'dd MMM yyyy')}</span>
                        {new Date(po.tillDate) < new Date() ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold">Expired</span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">Valid</span>
                        )}
                      </span>
                    ) : '—'}
                    icon={Clock}
                  />
                </div>
              </div>

              {/* Supplier Invoice Document Vault */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Supplier Tax Invoice Document
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInvoiceModalOpen(true)}
                    className="h-6 text-[10px] font-semibold px-2 rounded border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 gap-1 cursor-pointer"
                  >
                    {po.supplierInvoiceFile ? <Edit className="w-2.5 h-2.5" /> : <UploadCloud className="w-2.5 h-2.5" />}
                    {po.supplierInvoiceFile ? 'Manage / Update' : 'Attach File'}
                  </Button>
                </div>

                {(() => {
                  const invoiceFiles = parseInvoiceFiles(po.supplierInvoiceFile, po.referenceNo || po.rmId);
                  const hasDocs = invoiceFiles.length > 0;
                  if (!hasDocs) {
                    return (
                      <div 
                        onClick={() => setInvoiceModalOpen(true)}
                        className="p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between gap-2 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] text-slate-500">No original tax invoice file attached</span>
                        </div>
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                          + Upload PDF / Image
                        </span>
                      </div>
                    );
                  }

                  const primaryDoc = invoiceFiles[0];
                  const isPrimaryPdf = primaryDoc ? isPdfDocument(primaryDoc.name || primaryDoc.url) : false;

                  return (
                    <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          isPrimaryPdf ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'
                        }`}>
                          {isPrimaryPdf ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {po.supplierInvoiceNo ? `Invoice #${po.supplierInvoiceNo}` : primaryDoc.name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white dark:bg-slate-800 border text-slate-600 dark:text-slate-300 uppercase">
                              {isPrimaryPdf ? 'PDF' : 'IMAGE'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {invoiceFiles.length > 1 ? `${invoiceFiles.length} files attached` : (primaryDoc.name || 'Verified')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewInvoiceModal(invoiceFiles)}
                          className="h-6 text-[10px] font-semibold px-2 rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-indigo-50 text-indigo-600 gap-1 cursor-pointer"
                        >
                          <Eye className="w-2.5 h-2.5" /> Preview
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoiceFile(primaryDoc, po.referenceNo || po.rmId)}
                          className="h-6 text-[10px] font-semibold px-2 rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 gap-1 cursor-pointer"
                        >
                          <Download className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────────
              SECOND SECTION: UPDATED INVENTORY & STOCK BATCHES
              ─────────────────────────────────────────────────────────────────── */}
          <div className={`bg-white dark:bg-slate-900 border rounded-lg p-4 shadow-2xs ${
            inInventory 
              ? 'border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-b from-emerald-50/20 to-white dark:from-emerald-950/10 dark:to-slate-900' 
              : 'border-slate-200 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${
                  inInventory 
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    Updated Inventory & Stock Batches
                    {batches.length > 0 && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {batches.length} Active Batch{batches.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isLabExempt 
                      ? 'Lab-exempt material directly credited to raw material warehouse stock.' 
                      : (labApproved 
                          ? 'Quality passed & stored into warehouse inventory stock with sequential batch tracking.' 
                          : 'Material stock allocation awaits QA/QC lab inspection approval.')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isLabExempt && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Lab Exempt
                  </span>
                )}
                {inInventory ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Inventory Updated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Pending Stock Inward
                  </span>
                )}
              </div>
            </div>

            {batches.length > 0 ? (
              <div className="space-y-2.5">
                {/* SAP Batch Overview Cards */}
                {batches.map((batch, idx) => (
                  <div
                    key={batch.id || idx}
                    className="p-3 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all shadow-3xs"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          {batch.batchNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBatch(batch.batchNumber)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          title="Copy Batch Number"
                        >
                          {copiedBatch === batch.batchNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                          🟢 {batch.status || 'AVAILABLE'}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                          {batch.rawMaterialName || po.name} {batch.rmCategory ? `• ${batch.rmCategory}` : ''}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Net Stock Stored</span>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                          {Number(batch.netQty || batch.receivedQty || batch.quantity || 0).toLocaleString()} {getBatchUom(batch)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Warehouse Bin / Location</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{batch.storageLocation || 'Main RM Warehouse'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Mfg Date</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{batch.mfgDate ? format(new Date(batch.mfgDate), 'dd MMM yyyy') : '—'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Expiry Date</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{batch.expiryDate ? format(new Date(batch.expiryDate), 'dd MMM yyyy') : 'No Expiry'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Inward Timestamp</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{batch.createdAt ? format(new Date(batch.createdAt), 'dd MMM yyyy, HH:mm') : '—'}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-dashed border-slate-200/80 dark:border-slate-800 text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span>Associated GRN:</span>
                        {grnList.find(g => g.id === batch.grnId || g.referenceNo === batch.grnReferenceNo) ? (
                          <Link
                            to={`/grn/view/${grnList.find(g => g.id === batch.grnId || g.referenceNo === batch.grnReferenceNo)?.id}`}
                            className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <span>{grnList.find(g => g.id === batch.grnId || g.referenceNo === batch.grnReferenceNo)?.referenceNo || batch.grnReferenceNo}</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <strong className="font-mono text-slate-800 dark:text-slate-200">{batch.grnReferenceNo || grn?.referenceNo || 'Direct Inward'}</strong>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1 font-semibold cursor-pointer"
                        onClick={() => handleViewInStock(batch)}
                      >
                        <Boxes className="w-3 h-3" /> View in RM Stock
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">No stock batches recorded yet</p>
                    <p className="text-[11px]">
                      {po.status === 'RECEIVED' || po.status === 'APPROVED'
                        ? 'Goods receipt confirmed. Click Sync Stock to regenerate inventory ledger batches.'
                        : 'Batches will be generated automatically upon receiving goods and passing QA lab tests.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-100 gap-1 font-medium"
                  onClick={() => handleViewInStock()}
                >
                  <Boxes className="w-3.5 h-3.5" /> View RM Master Stock
                </Button>
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────────────
              THIRD SECTION: MULTIPLE GRN & PARTIAL DELIVERIES HISTORY
              ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    Goods Receipts (GRN) & Multi-Shipment Deliveries
                    <span className="font-mono text-[11px] font-bold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {grnList.length} Shipment{grnList.length !== 1 ? 's' : ''} Recorded
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Complete goods receipt note tracking for single or partial shipment receipts against this PO.
                  </p>
                </div>
              </div>

              {/* Action button to receive delivery if pending */}
              {totalPendingQty > 0 && (isOrdered || po.status === 'RECEIVED') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 gap-1.5 cursor-pointer"
                  onClick={() => navigate(`/grn/receive/${po.id}`)}
                >
                  <Plus className="w-3.5 h-3.5" /> Receive Partial Shipment ({totalPendingQty} {po.uom?.abbreviation || ''})
                </Button>
              )}
            </div>

            {/* Delivery Fulfillment Progress Bar */}
            <div className="p-3 mb-3.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-slate-500">Order Delivery Fulfillment:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {totalReceivedQty.toLocaleString()} / {totalOrderedQty.toLocaleString()} {po.uom?.abbreviation || ''}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    deliveryProgressPct >= 100 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}>
                    {deliveryProgressPct}% Received
                  </span>
                </div>
                {totalPendingQty > 0 ? (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 font-mono">
                    Pending Delivery: {totalPendingQty.toLocaleString()} {po.uom?.abbreviation || ''}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Full Order Quantity Fulfilled
                  </span>
                )}
              </div>

              {/* Progress bar line */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    deliveryProgressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${deliveryProgressPct}%` }}
                />
              </div>
            </div>

            {/* List of All GRNs */}
            {grnList.length > 0 ? (
              <div className="space-y-3">
                {grnList.map((g, idx) => {
                  const gQty = g.totalReceivedQty != null 
                    ? Number(g.totalReceivedQty) 
                    : (Array.isArray(g.items) ? g.items.reduce((s, it) => s + (Number(it.actualReceivedQty) || 0), 0) : 0);
                  const gExempt = g.isExempt || (g.items?.length > 0 && g.items.every(i => i.labTestRequired === false));
                  const gLabApproved = g.labTest?.overallDecision === 'APPROVED' || g.status === 'LAB_APPROVED';
                  const gLabRejected = g.labTest?.overallDecision === 'REJECTED' || g.status === 'LAB_REJECTED';

                  return (
                    <div 
                      key={g.id || idx}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-indigo-400 dark:hover:border-indigo-700 transition-all shadow-3xs"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Shipment #{idx + 1}
                          </span>
                          <Link
                            to={`/grn/view/${g.id}`}
                            className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            title="Click to view full Goods Receipt Document"
                          >
                            <span>{g.referenceNo}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          {gExempt ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Lab Exempt
                            </span>
                          ) : gLabApproved ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Lab Approved
                            </span>
                          ) : gLabRejected ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-600" /> Lab Rejected
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" /> Pending Lab QC
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">
                            Received Date: <strong>{g.receivedDate ? format(new Date(g.receivedDate), 'dd MMM yyyy') : '—'}</strong>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] font-semibold px-2 rounded border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1 cursor-pointer"
                            onClick={() => navigate(`/grn/view/${g.id}`)}
                          >
                            <Eye className="w-2.5 h-2.5" /> Open GRN
                          </Button>
                        </div>
                      </div>

                      {/* Shipment Received Items Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-2.5">
                        <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Actual Received Qty</span>
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {gQty.toLocaleString()} {po.uom?.abbreviation || ''}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Receiver Official</span>
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                            {g.receiver?.name || 'Materials Receiver'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Settlement on Inward</span>
                          <span className="font-mono font-semibold text-xs text-slate-800 dark:text-slate-200 mt-0.5 block">
                            Paid: ₹{Number(g.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            {Number(g.refundAmount || 0) > 0 && ` • Refund: ₹${Number(g.refundAmount).toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      </div>

                      {/* Items details within this GRN */}
                      {Array.isArray(g.items) && g.items.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-dashed border-slate-200/80 dark:border-slate-800">
                          {g.items.map(it => (
                            <div key={it.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 flex-wrap gap-2">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{it.rmName || it.name || po.name}</span>
                              <div className="flex items-center gap-3 font-mono text-[11px]">
                                <span>Expected: {Number(it.expectedQty || 0).toLocaleString()}</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  Received: {Number(it.actualReceivedQty || 0).toLocaleString()}
                                </span>
                                {Number(it.returnQty || 0) > 0 && (
                                  <span className="text-rose-500 font-bold">
                                    Rejected / Returned: {Number(it.returnQty).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">No Goods Receipt Notes created yet</p>
                    <p className="text-[11px]">
                      When shipment arrives at warehouse gate, receive single or partial deliveries to track goods receipts.
                    </p>
                  </div>
                </div>
                {isOrdered && (
                  <Button
                    size="sm"
                    className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    onClick={() => navigate(`/grn/receive/${po.id}`)}
                  >
                    <Truck className="w-3.5 h-3.5" /> Receive Inward Delivery
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────────────
              MATERIAL & ORDERED ITEMS (SAP Line Items Table)
              ─────────────────────────────────────────────────────────────────── */}
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs transition-all duration-1000 ${
            highlightActive ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md bg-indigo-50/10' : ''
          }`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Material & Ordered Line Items
                  </h3>
                  <p className="text-[10px] text-slate-400">Specification, Quantities, Pricing & GST</p>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Supplier: <span className="font-semibold text-slate-800 dark:text-slate-200">{po.supplier?.name || '—'}</span>
              </div>
            </div>

            {Array.isArray(po.items) && po.items.length > 0 ? (
              <div className="space-y-3">
                {/* Desktop SAP Table */}
                <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Item & Code</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-center">GST %</th>
                        <th className="py-2.5 px-3 text-right">Item Total</th>
                        <th className="py-2.5 px-3 text-center">Quality / Lab Route</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {po.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{item.rmId || item.code || '—'}</div>
                            
                            {/* Attached batch specifications if any */}
                            {Array.isArray(item.batches) && item.batches.length > 1 ? (
                              <div className="mt-1 space-y-1">
                                {item.batches.map((b, bIdx) => (
                                  <div key={b.id || bIdx} className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded border border-slate-200/70 dark:border-slate-800">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      Batch #{bIdx + 1} ({b.batchQuantity ?? b.quantity} {item.uomLabel || item.uom || ''}):
                                    </span>
                                    {b.weight && <span className="inline-flex items-center gap-0.5"><Scale className="w-2.5 h-2.5 text-indigo-500" /> {b.weight}</span>}
                                    {b.mfgBatchNo && <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-mono font-medium"><Tag className="w-2.5 h-2.5" /> {b.mfgBatchNo}</span>}
                                    {b.mfgDate && <span className="inline-flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5 text-indigo-500" /> MFG: {typeof b.mfgDate === 'string' && b.mfgDate.includes('T') ? format(new Date(b.mfgDate), 'dd-MM-yyyy') : b.mfgDate}</span>}
                                    {b.expDate && <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Clock className="w-2.5 h-2.5 text-amber-500" /> EXP: {typeof b.expDate === 'string' && b.expDate.includes('T') ? format(new Date(b.expDate), 'dd-MM-yyyy') : b.expDate}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (item.batchQuantity || item.weight || item.mfgBatchNo || item.mfgDate || item.expDate) ? (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-slate-500">
                                {item.batchQuantity !== undefined && item.batchQuantity !== null && item.batchQuantity !== item.quantity && (
                                  <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 px-1.5 py-0.2 rounded font-medium border border-blue-200">
                                    Batch Qty: {item.batchQuantity} {item.uomLabel || item.uom || ''}
                                  </span>
                                )}
                                {item.weight && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-medium border border-slate-200"><Scale className="w-2.5 h-2.5 text-indigo-500 inline mr-0.5" /> {item.weight}</span>}
                                {item.mfgBatchNo && <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 px-1.5 py-0.2 rounded font-mono font-medium border border-indigo-200"><Tag className="w-2.5 h-2.5 text-indigo-500 inline mr-0.5" /> {item.mfgBatchNo}</span>}
                                {item.mfgDate && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-medium border border-slate-200">MFG: {typeof item.mfgDate === 'string' && item.mfgDate.includes('T') ? format(new Date(item.mfgDate), 'dd-MM-yyyy') : item.mfgDate}</span>}
                                {item.expDate && <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 px-1.5 py-0.2 rounded font-medium border border-amber-200">EXP: {typeof item.expDate === 'string' && item.expDate.includes('T') ? format(new Date(item.expDate), 'dd-MM-yyyy') : item.expDate}</span>}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.itemType === 'NON_INVENTORY'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {item.itemType === 'NON_INVENTORY' ? '🚫 Non-Inv' : '🌾 Raw Material'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold font-mono">
                            {item.quantity} {item.uomLabel || item.uom || ''}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            ₹{Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60">
                              {item.gstPercentage !== undefined ? item.gstPercentage : (item.gstPercent !== undefined ? item.gstPercent : (item.gstApplicable !== false ? 18 : 0))}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                            ₹{Number(item.total || ((item.quantity || 0) * (item.unitPrice || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.labTestRequired !== false ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                <FlaskConical className="w-3 h-3 text-emerald-600" /> Lab Required
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200">
                                <ShieldCheck className="w-3 h-3 text-rose-600" /> Lab Exempt
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet Responsive Line Items */}
                <div className="lg:hidden space-y-2.5">
                  {po.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                            {item.name}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                            {item.rmId || item.code || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            item.itemType === 'NON_INVENTORY'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {item.itemType === 'NON_INVENTORY' ? '🚫 Non-Inv' : '🌾 Raw Mat'}
                          </span>
                          {item.labTestRequired !== false ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              <FlaskConical className="w-2.5 h-2.5" /> Lab
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800">
                              <ShieldCheck className="w-2.5 h-2.5" /> Exempt
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                        <div className="p-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Ordered</span>
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 mt-0.5 block">
                            {item.quantity} {item.uomLabel || item.uom || ''}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Rate & GST</span>
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 mt-0.5 block">
                            ₹{Number(item.unitPrice || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9px] text-indigo-600 font-semibold block">
                            {item.gstPercentage !== undefined ? item.gstPercentage : 18}% GST
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
                          <span className="text-[9px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">Total</span>
                          <span className="font-mono font-black text-xs text-indigo-950 dark:text-indigo-200 mt-0.5 block truncate">
                            ₹{Number(item.total || ((item.quantity || 0) * (item.unitPrice || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <InfoRow icon={FileText} label="Raw Material Name" value={po.name} />
                <InfoRow icon={Tag} label="RM Code / ID" value={po.rmId} />
                <InfoRow icon={Package} label="Quantity" value={`${po.quantity} ${po.uom?.abbreviation || ''}`} />
                <InfoRow icon={User} label="Supplier" value={po.supplier?.name || '—'} />
                <div className="flex items-center justify-between pt-2.5 text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5 text-slate-400" /> Lab Inspection Policy:
                  </span>
                  {isLabExempt ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-600" /> Lab Exempt (Direct Inward)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <FlaskConical className="w-3.5 h-3.5 text-emerald-600" /> Quality Lab Test Required
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────────────
              QUALITY LAB TESTING & QC RESULTS SECTION
              ─────────────────────────────────────────────────────────────────── */}
          {/* Pending QA Queue Banner */}
          {!isLabExempt && hasGRN && !labApproved && !labRejected && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-700/60 rounded-lg p-4 shadow-3xs">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Quality Lab Testing in Progress
                    </h3>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Goods arrived and currently in QC quarantine. Stock will update upon QA approval.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  <Clock className="w-3.5 h-3.5" /> Pending Lab Inspection
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800/50 text-xs flex-wrap gap-2">
                <span className="text-amber-800 dark:text-amber-300">
                  GRN Reference: <strong className="font-mono">{grn?.referenceNo || 'Pending'}</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950 font-semibold"
                  onClick={() => navigate('/grn/lab-tests')}
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1" /> View in Lab Test Queue
                </Button>
              </div>
            </div>
          )}

          {/* QA Inspection Report Card */}
          {!isLabExempt && labTest && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                    <FlaskConical className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Quality Lab Inspection & Certificate
                    </h3>
                    <p className="text-[10px] text-slate-400">QA/QC Batch Test Outcome</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {labTest.overallDecision === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> QA Approved
                    </span>
                  )}
                  {labTest.overallDecision === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400">
                      <XCircle className="w-3.5 h-3.5" /> QA Rejected
                    </span>
                  )}
                  {labTest.overallDecision === 'NEED_SAMPLE' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Re-sample Required
                    </span>
                  )}
                </div>
              </div>

              {labTest.labNotes && (
                <div className="p-2.5 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 mb-3">
                  <strong>QA Inspector Notes:</strong> {labTest.labNotes}
                </div>
              )}

              {labCategoryParams && typeof labCategoryParams === 'object' && (
                <div className="space-y-1.5 mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Parameters Analyzed</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(labCategoryParams).map(([param, val]) => (
                      <div key={param} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-800 text-xs">
                        <span className="text-slate-500">{param}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {labTest.testResults?.map(tr => (
                <div key={tr.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{tr.rmName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Expiry Date: {tr.expiryDate ? format(new Date(tr.expiryDate), 'dd MMM yyyy') : '—'}</p>
                    {tr.testNotes && <p className="text-[11px] text-slate-500 mt-0.5">{tr.testNotes}</p>}
                  </div>
                  {tr.passed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                      <CheckCircle2 className="w-4 h-4" /> Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                      <XCircle className="w-4 h-4" /> Failed
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              FINANCIAL, TAX & COMMERCIAL ACCOUNTING
              ─────────────────────────────────────────────────────────────────── */}
          {(() => {
            const isInterState = po.supplier?.gstin ? !po.supplier.gstin.trim().startsWith('33') : false;
            const charges = [];
            const shippingVal = Number(po.shipping || 0);
            const otherVal = Number(po.otherCharges || 0);
            const shippingGstApplicable = Boolean(po.shippingGstApplicable || (shippingVal > 0 && po.items?.[0]?.shippingGstApplicable));
            const shippingRate = Number(po.shippingGstPercentage ?? 18);
            const otherGstApplicable = Boolean(po.otherChargesGstApplicable || (otherVal > 0 && po.items?.[0]?.otherChargesGstApplicable));
            const otherRate = Number(po.otherChargesGstPercentage ?? 18);
            const otherLabel = po.otherChargesLabel || 'Loading & Unloading';

            if (shippingVal > 0) {
              charges.push({
                label: 'Shipping / Freight',
                value: shippingVal,
                applied: true,
                gstApplicable: shippingGstApplicable,
                rate: shippingRate,
              });
            }
            if (otherVal > 0) {
              charges.push({
                label: otherLabel,
                value: otherVal,
                applied: true,
                gstApplicable: otherGstApplicable,
                rate: otherRate,
              });
            }

            const breakdown = calculateGstBreakdown({
              items: Array.isArray(po.items) ? po.items : [],
              charges,
              isInterState
            });

            const activeRateBlocks = breakdown.sortedBlocks.filter(b => b.rate > 0);
            const singleBlock = activeRateBlocks.length === 1 ? activeRateBlocks[0] : null;
            const cgstRateText = singleBlock ? `${(singleBlock.rate / 2)}%` : null;
            const sgstRateText = singleBlock ? `${(singleBlock.rate / 2)}%` : null;
            const igstRateText = singleBlock ? `${singleBlock.rate}%` : null;
            const cgstLabel = cgstRateText ? `CGST @ ${cgstRateText}` : 'CGST (Intrastate)';
            const sgstLabel = sgstRateText ? `SGST @ ${sgstRateText}` : 'SGST (Intrastate)';
            const igstLabel = igstRateText ? `IGST @ ${igstRateText}` : 'IGST (Interstate)';

            const displayTaxable = breakdown.totalTaxable > 0 ? breakdown.totalTaxable : parseFloat(po.subtotal || po.amount);
            const displayCgst = Number(po.cgst || 0) > 0 ? parseFloat(po.cgst) : breakdown.totalCgst;
            const displaySgst = Number(po.sgst || 0) > 0 ? parseFloat(po.sgst) : breakdown.totalSgst;
            const displayIgst = Number(po.igst || 0) > 0 ? parseFloat(po.igst) : breakdown.totalIgst;

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <IndianRupee className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Financial & Tax Accounting Details
                      </h3>
                      <p className="text-[10px] text-slate-400">GST Breakdown & Commercial Pricing</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    INR (₹)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Key Ledger Figures */}
                  <div className="space-y-2 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Items Subtotal:</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                        ₹{parseFloat(po.subtotal || po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Taxable Value:</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                        ₹{displayTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {isInterState ? (
                      (displayIgst > 0 || breakdown.totalGst > 0) && (
                        <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                          <span className="text-slate-500 inline-flex items-center gap-1.5">
                            <span>{igstLabel}</span>
                            <GstCalculationModal 
                              items={Array.isArray(po.items) ? po.items : []} 
                              charges={charges} 
                              isInterState={true} 
                              breakdownData={breakdown} 
                            />
                          </span>
                          <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                            ₹{displayIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )
                    ) : (
                      <>
                        {(displayCgst > 0 || breakdown.totalCgst > 0) && (
                          <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                            <span className="text-slate-500 inline-flex items-center gap-1.5">
                              <span>{cgstLabel}</span>
                              <GstCalculationModal 
                                items={Array.isArray(po.items) ? po.items : []} 
                                charges={charges} 
                                isInterState={false} 
                                breakdownData={breakdown} 
                              />
                            </span>
                            <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                              ₹{displayCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}

                        {(displaySgst > 0 || breakdown.totalSgst > 0) && (
                          <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                            <span className="text-slate-500 inline-flex items-center gap-1.5">
                              <span>{sgstLabel}</span>
                              <GstCalculationModal 
                                items={Array.isArray(po.items) ? po.items : []} 
                                charges={charges} 
                                isInterState={false} 
                                breakdownData={breakdown} 
                              />
                            </span>
                            <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                              ₹{displaySgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {Number(po.discount || 0) > 0 && (
                      <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                        <span className="text-slate-500">Discount:</span>
                        <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                          -₹{parseFloat(po.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {shippingVal > 0 && (
                      <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                        <span className="text-slate-500">
                          Shipping / Freight {shippingGstApplicable ? `(+${shippingRate}% GST)` : ''}:
                        </span>
                        <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                          +₹{shippingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {otherVal > 0 && (
                      <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5 text-xs">
                        <span className="text-slate-500">
                          {otherLabel} {otherGstApplicable ? `(+${otherRate}% GST)` : ''}:
                        </span>
                        <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                          +₹{otherVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-2 font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      <div>
                        <div>Grand Total:</div>
                        <div className="text-[9px] font-normal text-slate-400">Taxes, freight & loading included</div>
                      </div>
                      <span className="font-mono text-base font-extrabold">
                        ₹{parseFloat(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Right: Payment Status & Audit Dates */}
                  <div className="space-y-2 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Payment Status:</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                          (po.paymentStatus || 'UNPAID') === 'PAID'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200'
                            : po.paymentStatus === 'PARTIALLY_PAID'
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border-indigo-200'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200'
                        }`}>
                          {po.paymentStatus === 'PAID' ? '🟢 FULLY PAID' : po.paymentStatus === 'PARTIALLY_PAID' ? '🔵 PARTIALLY PAID' : '🔴 UNPAID'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Amount Paid:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          ₹{parseFloat(po.paidAmount || (po.paymentStatus === 'PAID' ? (po.grandTotal || po.amount) : 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Balance Due:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                          ₹{Math.max(0, (po.grandTotal && Number(po.grandTotal) > 0 ? Number(po.grandTotal) : Number(po.amount)) - Number(po.paidAmount || (po.paymentStatus === 'PAID' ? (po.grandTotal || po.amount) : 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Target Delivery</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{format(new Date(po.expectedDelivery), 'dd MMM yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Created By</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{po.user?.name || 'System User'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ───────────────────────────────────────────────────────────────────
              PAYMENT & SETTLEMENT MANAGER (Card View)
              ─────────────────────────────────────────────────────────────────── */}
          <PaymentSettlementCardView
            po={po}
            onOpenUpdateModal={() => {
              setSelectedInstallmentIndex(null);
              setPaymentModalOpen(true);
            }}
            onEditInstallment={(idx) => {
              setSelectedInstallmentIndex(idx);
              setPaymentModalOpen(true);
            }}
          />

          {/* Notes / Special Instructions */}
          {po.notes && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" /> Notes & Commercial Terms
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {po.notes}
              </div>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────────────
            RIGHT COLUMN: STICKY SAP TOOLS, QR CODE & AUDIT SIDEBAR
            ─────────────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col items-center space-y-3.5 sticky top-4">
            
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-indigo-500" /> RM QR Code
              </span>
              <span className="font-mono text-[10px] text-slate-400">Ver. 2.0</span>
            </div>

            {/* Draggable QR Code */}
            <div 
              draggable="true"
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', qrData);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="bg-white p-2.5 rounded-lg shadow-2xs border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:scale-102 transition-all duration-200"
              title="Drag and drop this QR code onto the header Scan icon to track its lifecycle!"
            >
              <QRCode value={qrData} size={152} level="M" fgColor="#0f172a" />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 w-full text-center">
              <span className="font-mono text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200">
                {po.referenceNo || po.rmId}
              </span>
            </div>

            {/* Active Batch Summary Pill */}
            {batches.length > 0 && (
              <div className="w-full p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                <span className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-bold block">
                  Active Stock Batch ({batches.length})
                </span>
                <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  {batches[0].batchNumber}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                  {Number(batches[0].netQty || batches[0].receivedQty || 0)} {getBatchUom(batches[0])} Stored
                </span>
              </div>
            )}

            {/* Step Checklist */}
            <div className="w-full space-y-1 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              {[
                { label: 'PO Created', done: true },
                { label: 'GRN Inwarded', done: hasGRN || inInventory },
                { label: isLabExempt ? 'Lab Exempt' : 'Lab Inspection', done: isLabExempt ? (hasGRN || inInventory) : labApproved },
                { label: 'Stock Batches Created', done: inInventory },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
                  s.done ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'
                }`}>
                  {s.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Cross Document Direct Navigation Shortcuts */}
            <div className="w-full space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Direct System Links:
              </span>

              {po.supplier && (
                <button
                  type="button"
                  onClick={() => {
                    if (po.supplier?.id) navigate(`/parties/suppliers/edit/${po.supplier.id}`, { state: po.supplier });
                    else navigate(`/parties/suppliers`);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Building className="w-3 h-3 text-indigo-500" /> Vendor Profile
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              )}

              {grn && (
                <button
                  type="button"
                  onClick={() => navigate(`/grn/view/${grn.id}`)}
                  className="w-full flex items-center justify-between p-2 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Truck className="w-3 h-3 text-emerald-500" /> View GRN Inward
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleViewInStock()}
                className="w-full flex items-center justify-between p-2 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Boxes className="w-3 h-3 text-teal-500" /> RM Stock Ledger
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            <p className="text-[10px] text-center text-slate-400 pt-1">
              Scan barcode/QR on gate scanner to load PO lifecycle details
            </p>
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
              ...(po.notes ? [{ label: 'NOTES', value: po.notes }] : []),
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

      {/* Multi-Installment Payment Settlement Modal */}
      {paymentModalOpen && (
        <UpdatePaymentSettlementModal
          po={po}
          initialEditIndex={selectedInstallmentIndex}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedInstallmentIndex(null);
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['po', id] });
            queryClient.invalidateQueries({ queryKey: ['pos'] });
          }}
        />
      )}

      {/* Payment Proof Fullscreen Image Modal */}
      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          title={`Payment Proof — ${po.referenceNo || po.rmId}`}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Supplier Invoice Document Fullscreen Viewer Tool Modal */}
      {previewInvoiceModal && (
        <InvoiceViewerToolModal
          files={Array.isArray(previewInvoiceModal) ? previewInvoiceModal : parseInvoiceFiles(previewInvoiceModal, po.referenceNo || po.rmId)}
          title="Supplier Tax Invoice Document"
          poReference={po.referenceNo || po.rmId}
          invoiceNo={po.supplierInvoiceNo}
          onClose={() => setPreviewInvoiceModal(null)}
        />
      )}

      {/* Supplier Invoice Upload / Replace / Delete Modal */}
      {invoiceModalOpen && (
        <SupplierInvoiceModal
          isOpen={true}
          po={po}
          onClose={() => setInvoiceModalOpen(false)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['po', id] });
            queryClient.invalidateQueries({ queryKey: ['pos'] });
          }}
        />
      )}

      {/* PO Export Modal (Interactive Header/Detail Checkboxes, Live Download Timestamp, PDF & ExcelJS) */}
      <POExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allPOs={po ? [po] : []}
        selectedPOs={po ? [po] : []}
        defaultFormat={exportModalFormat}
      />
    </div>
  );
}

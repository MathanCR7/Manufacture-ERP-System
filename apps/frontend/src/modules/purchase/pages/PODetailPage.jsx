import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { format } from 'date-fns';
import {
  ArrowLeft, Trash2, User, Calendar, FileText, IndianRupee, Printer, Edit,
  QrCode, Package, FlaskConical, CheckCircle2, XCircle, AlertTriangle,
  Clock, ChevronRight, Truck, Tag, BarChart3
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

const LAB_STATUS_CONFIG = {
  PENDING_LAB:  { label: 'Pending Lab',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', icon: FlaskConical },
  LAB_APPROVED: { label: 'Lab Approved',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle2 },
  LAB_REJECTED: { label: 'Lab Rejected',  color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', icon: XCircle },
  LAB_RESAMPLE: { label: 'Re-sample',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400', icon: AlertTriangle },
};

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
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
      done ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
      : active ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30'
      : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
    }`}>
      <Icon className="w-3 h-3" />
      {step}
    </div>
  );
}

export default function PODetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromNotifications = location.state?.from === '/notifications';
  const queryClient = useQueryClient();
  const [showQR, setShowQR] = useState(true);
  const [highlightActive, setHighlightActive] = useState(!!location.state?.highlight);

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

  // Fetch GRN for this PO
  const { data: grnData } = useQuery({
    queryKey: ['grn-for-po-detail', id],
    queryFn: async () => {
      const res = await api.get(`/grn/receive`);
      const grns = Array.isArray(res.data) ? res.data : [];
      return grns.find(g => g.poId === id) || null;
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

  const isPending = po.status === 'PENDING';
  const grn = grnData;
  const labTest = grn?.labTest;
  const labCategoryParams = labTest?.categoryParams;

  const hasPO = true;
  const hasGRN = !!grn;
  const hasLabTest = !!labTest;
  const labApproved = labTest?.overallDecision === 'APPROVED';
  const labRejected = labTest?.overallDecision === 'REJECTED';
  const inInventory = labApproved;

  const qrData = JSON.stringify({
    poNumber: po.referenceNo,
    supplierName: po.supplier?.name || '',
    rawMaterial: po.name,
    quantity: po.quantity,
    uom: po.uom?.abbreviation,
    expectedDelivery: po.expectedDelivery,
    poAmount: po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount,
    paymentStatus: po.status,
    ...(grn && {
      grnNumber: grn.referenceNo,
      actualReceivedQty: grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0),
      refundAmount: grn.refundAmount,
      amountPaid: grn.amountPaid,
      receivedDate: grn.receivedDate,
      grnStatus: grn.status,
    }),
    ...(labTest && {
      labDecision: labTest.overallDecision,
      labNotes: labTest.labNotes,
      labParams: labCategoryParams,
    }),
    generatedAt: new Date().toISOString(),
  });

  const labStatusCfg = grn ? (LAB_STATUS_CONFIG[grn.status] || LAB_STATUS_CONFIG.PENDING_LAB) : null;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(location.state?.from || '/purchase-orders')} className="text-slate-500 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">PO: {po.referenceNo || po.rmId}</h1>
              <StatusBadge status={po.status} />
              {grn && labStatusCfg && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${labStatusCfg.color}`}>
                  <labStatusCfg.icon className="w-3 h-3" />
                  {labStatusCfg.label}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Created {format(new Date(po.createdAt), 'PPP')} · RM: {po.rmId}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {isPending && (
            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => navigate(`/purchase-orders/edit/${id}`)}>
              <Edit className="w-4 h-4 mr-2" /> Edit
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

      {/* Lifecycle Steps */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Procurement Lifecycle</p>
        <div className="flex flex-wrap items-center gap-2">
          <LifecycleStep step="PO Raised" active={hasPO && !hasGRN} done={hasGRN} icon={FileText} />
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          <LifecycleStep step="GRN Received" active={hasGRN && !hasLabTest} done={hasLabTest} icon={Truck} />
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          <LifecycleStep step="Lab Testing" active={hasLabTest && !labApproved} done={labApproved || labRejected} icon={FlaskConical} />
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          <LifecycleStep step="Inventory Updated" active={false} done={inInventory} icon={BarChart3} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Material Details */}
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-all duration-1000 ${highlightActive ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md shadow-indigo-200 dark:shadow-indigo-900 bg-indigo-50/10 dark:bg-indigo-950/15 animate-pulse' : ''}`}>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Material Details
            </h3>
            <InfoRow icon={FileText} label="Raw Material Name" value={po.name} />
            <InfoRow icon={Tag} label="RM Code / ID" value={po.rmId} />
            <InfoRow icon={Package} label="Quantity" value={`${po.quantity} ${po.uom?.abbreviation || ''}`} />
            <InfoRow icon={User} label="Supplier" value={po.supplier?.name || '—'} />
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

          {/* Lab Test Results */}
          {labTest && (
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

            <div className="w-full space-y-1.5 text-xs">
              {[
                { label: 'PO Details', done: hasPO },
                { label: 'GRN Receipt', done: hasGRN },
                { label: 'Lab Results', done: hasLabTest },
                { label: 'Inventory', done: inInventory },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-2 px-2 py-1 rounded ${s.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {s.done
                    ? <CheckCircle2 className="w-3 h-3" />
                    : <Clock className="w-3 h-3" />
                  }
                  {s.label}
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-slate-400">Scan to view all accumulated details</p>
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
              { label: 'SUPPLIER', value: po.supplier?.name || '—' },
              { label: 'EXP. DELIVERY', value: format(new Date(po.expectedDelivery), 'dd-MM-yyyy') },
              { label: 'STATUS', value: po.status },
              ...(grn ? [
                { label: 'GRN NO', value: grn.referenceNo },
                { label: 'RCVD DATE', value: grn.receivedDate ? format(new Date(grn.receivedDate), 'dd-MM-yyyy') : '—' },
              ] : []),
              ...(labTest ? [
                { label: 'LAB RESULT', value: labTest.overallDecision || '—' },
              ] : []),
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

import React, { useState } from 'react';
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

  // Fetch PO
  const { data: po, isLoading, error } = useQuery({
    queryKey: ['po', id],
    queryFn: async () => {
      const response = await api.get(`/rm/po/${id}`);
      return response.data;
    }
  });

  // Fetch GRN for this PO (to get lab results and actual qty)
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

  // Lifecycle state
  const hasPO = true;
  const hasGRN = !!grn;
  const hasLabTest = !!labTest;
  const labApproved = labTest?.overallDecision === 'APPROVED';
  const labRejected = labTest?.overallDecision === 'REJECTED';
  const inInventory = labApproved;

  // Build QR payload with all lifecycle data
  const qrData = JSON.stringify({
    // Stage 1: PO details
    poNumber: po.referenceNo,
    supplierName: po.supplier?.name || '',
    rawMaterial: po.name,
    quantity: po.quantity,
    uom: po.uom?.abbreviation,
    expectedDelivery: po.expectedDelivery,
    poAmount: po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount,
    paymentStatus: po.status,
    // Stage 2: GRN details (if received)
    ...(grn && {
      grnNumber: grn.referenceNo,
      actualReceivedQty: grn.items?.reduce((s, i) => s + Number(i.actualReceivedQty || 0), 0),
      refundAmount: grn.refundAmount,
      amountPaid: grn.amountPaid,
      receivedDate: grn.receivedDate,
      grnStatus: grn.status,
    }),
    // Stage 3: Lab results (if tested)
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
      {fromNotifications && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/notifications')} 
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Notifications Center
        </Button>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')} className="text-slate-500 rounded-full">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Material Details
            </h3>
            <InfoRow icon={FileText} label="Raw Material Name" value={po.name} />
            {po.supplier && (
              <InfoRow icon={User} label="Supplier" value={`${po.supplier.name}${po.supplier.phone ? ` · ${po.supplier.phone}` : ''}`} />
            )}
            {po.items && Array.isArray(po.items) && po.items.length > 0 ? (
              <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-850">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">#</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">Material Details</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase text-right">Quantity</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase text-center">UOM</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase text-right">Unit Price (₹)</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase text-center">GST Status</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase text-center">GST Rate</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase text-right">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {po.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                          <div className="text-xs font-mono text-slate-505 bg-slate-105 dark:bg-slate-800 w-fit px-1.5 py-0.5 rounded mt-0.5">{item.rmId}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">{item.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-mono">
                            {item.uomLabel || po.uom?.abbreviation || po.uom?.name || 'units'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">₹{Number(item.unitPrice || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${item.gstApplicable ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-505 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {item.gstApplicable ? 'GST Active' : 'Non-GST'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{item.gstPercentage || 0}%</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-955 dark:text-white">₹{(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <InfoRow icon={Tag} label="Quantity & UOM" value={`${po.quantity} ${po.uom?.abbreviation || po.uom?.name || ''}`} />
            )}
            
            {/* Detailed Pricing Breakdown */}
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-sm space-y-2.5">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Financial Summary</p>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Subtotal:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  ₹{parseFloat(po.subtotal && Number(po.subtotal) > 0 ? po.subtotal : po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {Number(po.igst || 0) > 0 && (
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">IGST:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    ₹{parseFloat(po.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

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
            </div>

            <InfoRow icon={Calendar} label="Expected Delivery" value={format(new Date(po.expectedDelivery), 'PPPP')} />
            <InfoRow icon={User} label="Created By" value={po.user?.name || '—'} />
          </div>

          {/* GRN Details (if received) */}
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

              {/* Category-specific params */}
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

              {/* Per-item test results */}
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

        {/* Right: QR Code */}
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

            {/* QR Stage indicator */}
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

      {/* Printable Label */}
      <div className="hidden print:flex fixed inset-0 bg-white z-[9999] flex-col items-center justify-center p-8 text-black">
        <div className="border-4 border-black p-8 rounded-2xl flex flex-col items-center max-w-sm w-full space-y-6">
          <h1 className="text-3xl font-black uppercase tracking-widest border-b-2 border-black pb-2 w-full text-center">RM Label</h1>
          <div className="bg-white p-2 border-2 border-black rounded-lg">
            <QRCode value={qrData} size={200} level="M" fgColor="#000000" />
          </div>
          <div className="w-full space-y-2 text-sm font-bold">
            {[
              { label: 'Ref No', value: po.referenceNo || po.rmId },
              { label: 'Item', value: po.name },
              { label: 'Quantity', value: `${po.quantity} ${po.uom?.abbreviation || ''}` },
              { label: 'Supplier', value: po.supplier?.name || '—' },
              { label: 'Exp. Delivery', value: format(new Date(po.expectedDelivery), 'dd-MM-yyyy') },
              { label: 'Status', value: po.status },
              ...(grn ? [
                { label: 'GRN No', value: grn.referenceNo },
                { label: 'Rcvd Date', value: grn.receivedDate ? format(new Date(grn.receivedDate), 'dd-MM-yyyy') : '—' },
              ] : []),
              ...(labTest ? [
                { label: 'Lab Result', value: labTest.overallDecision || '—' },
              ] : []),
              { label: 'Printed', value: format(new Date(), 'dd-MM-yyyy HH:mm') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between border-b border-gray-300 pb-1">
                <span className="text-gray-500 uppercase text-xs">{label}:</span>
                <span className="text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
